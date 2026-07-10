// ローカル動作確認用の ECS シミュレータ (依存パッケージなし)。
//
// MiniStack の ECS 実装は UpdateService が同期的に COMPLETED を返し、
// ListServiceDeployments も未実装 (常に空配列) のため、実際の ECS のように
// 「デプロイ直後は IN_PROGRESS、数秒〜数十秒後に COMPLETED/FAILED へ遷移する」
// 挙動やロールバックを試すことができない。このサーバはそのギャップを埋めるため、
// ecscd が使う ECS API のうち必要な部分だけを AWS JSON 1.1 プロトコルで実装し、
// ローカルにインメモリの状態を持って擬似的な非同期ロールアウトを再現する。
//
// DynamoDB / STS は引き続き ministack が担当し、ECS だけこのサーバに向ける
// (AWS SDK v3 は AWS_ENDPOINT_URL_ECS でサービス単位のエンドポイント上書きに対応している)。
const http = require("http");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8081);
const REGION = process.env.AWS_REGION || "us-east-1";
const ACCOUNT_ID = "000000000000";
const HISTORY_LIMIT = 5;

// ロールアウトの所要時間・結果分布。すべて環境変数で調整可能。
const ROLLOUT_MIN_MS = Number(process.env.ECS_SIM_ROLLOUT_MIN_MS || 8_000);
const ROLLOUT_MAX_MS = Number(process.env.ECS_SIM_ROLLOUT_MAX_MS || 25_000);
const ROLLBACK_DURATION_MS = Number(
  process.env.ECS_SIM_ROLLBACK_DURATION_MS || 4_000,
);
// hang (スタック) 状態はこの割合までしか進捗しない = 永遠に IN_PROGRESS のまま
const HANG_STALL_RATIO = 0.4;
// 通常デプロイの結果分布 (success / hang / failed)。hang はロールバック演習用、
// failed は "Failed" 表示の確認用 (現行 UI ではロールバック不可)。
const OUTCOME_WEIGHTS = parseWeights(
  process.env.ECS_SIM_OUTCOME_WEIGHTS || "success:0.7,hang:0.2,failed:0.1",
);

function parseWeights(spec) {
  const weights = {};
  for (const part of spec.split(",")) {
    const [key, value] = part.split(":");
    const num = Number(value);
    if (key && Number.isFinite(num) && num > 0) {
      weights[key.trim()] = num;
    }
  }
  // 不正な指定 (空文字・全滅など) だと pickWeighted が空の entries を掴んで落ちるので、
  // ここで検証して安全なデフォルト (success 固定) にフォールバックする。
  if (Object.keys(weights).length === 0) {
    console.error(
      `invalid ECS_SIM_OUTCOME_WEIGHTS ("${spec}"); falling back to success-only`,
    );
    return { success: 1 };
  }
  return weights;
}

function pickWeighted(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    if (r < w) return key;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

function randHex(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

// AWS JSON 1.1 プロトコルのタイムスタンプは Unix epoch 秒 (number) で表現される。
// Date を渡すと JSON.stringify が ISO 文字列にしてしまい、SDK 側の数値パースが
// NaN になって Deserialization error になるため、常にこの形で渡す。
function epochSeconds(ms) {
  return ms / 1000;
}

// --- ARN ヘルパー ---------------------------------------------------------

function taskDefinitionArn(family, revision) {
  return `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:task-definition/${family}:${revision}`;
}
function clusterArn(cluster) {
  return `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:cluster/${cluster}`;
}
function serviceArn(cluster, service) {
  return `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:service/${cluster}/${service}`;
}
function serviceDeploymentArn(cluster, service, id) {
  return `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:service-deployment/${cluster}/${service}/${id}`;
}

// --- 状態 -------------------------------------------------------------

const taskDefinitions = new Map(); // family -> array of stored task definitions (index 0 = revision 1)
const clusters = new Set();
const services = new Map(); // "cluster::service" -> serviceState
const forcedNext = new Map(); // "cluster::service" -> { outcome, durationMs } (次回 UpdateService だけに適用)

function serviceKey(cluster, service) {
  return `${cluster}::${service}`;
}

// 実 AWS が RegisterTaskDefinition 時に補完するサーバ側デフォルトを再現する
// (taskRoleArn/executionRoleArn/pidMode/ipcMode の空文字、コンテナ cpu:0)。
// docs/local-verification.md の「サーバ側デフォルトによる幻の差分」を参照。
function completeTaskDefinition(input) {
  const td = { ...input };
  td.taskRoleArn = td.taskRoleArn ?? "";
  td.executionRoleArn = td.executionRoleArn ?? "";
  td.pidMode = td.pidMode ?? "";
  td.ipcMode = td.ipcMode ?? "";
  td.containerDefinitions = (td.containerDefinitions || []).map((c) => ({
    ...c,
    cpu: c.cpu ?? 0,
  }));
  return td;
}

function resolveTaskDefinition(ref) {
  if (!ref) return null;
  let family;
  let revision;
  const arnMatch = ref.match(/task-definition\/([^:/]+):(\d+)$/);
  if (arnMatch) {
    family = arnMatch[1];
    revision = Number(arnMatch[2]);
  } else if (ref.includes(":")) {
    const [f, r] = ref.split(":");
    family = f;
    revision = Number(r);
  } else {
    family = ref;
  }
  const revisions = taskDefinitions.get(family);
  if (!revisions || revisions.length === 0) return null;
  if (revision) return revisions.find((r) => r.revision === revision) || null;
  return revisions[revisions.length - 1];
}

function createRollout({
  cluster,
  service,
  taskDefinitionArn: targetArn,
  previousTaskDefinitionArn,
  desiredCount,
  forceOutcome,
  forceDurationMs,
}) {
  const key = serviceKey(cluster, service);
  const forced = forceOutcome ? null : forcedNext.get(key);
  if (forced) forcedNext.delete(key);

  const outcome = forceOutcome || forced?.outcome || pickWeighted(OUTCOME_WEIGHTS);
  const durationMs =
    forceDurationMs ?? forced?.durationMs ?? randomInt(ROLLOUT_MIN_MS, ROLLOUT_MAX_MS);

  return {
    id: `ecs-svc/${randHex(10)}`,
    serviceDeploymentArn: serviceDeploymentArn(cluster, service, randHex(10)),
    taskDefinitionArn: targetArn,
    previousTaskDefinitionArn: previousTaskDefinitionArn || null,
    desiredCount,
    createdAt: Date.now(),
    rolloutDurationMs: Math.max(durationMs, 1),
    outcome, // 'success' | 'hang' | 'failed'
    stoppedAt: null,
  };
}

function progressRatio(rollout, elapsedMs) {
  if (rollout.outcome === "hang") {
    const ramp = Math.min(1, elapsedMs / rollout.rolloutDurationMs);
    return Math.min(HANG_STALL_RATIO, ramp * HANG_STALL_RATIO);
  }
  return Math.min(1, elapsedMs / rollout.rolloutDurationMs);
}

// ロールアウトの「今の見え方」を経過時間から都度計算する (タイマーは使わない)。
function deriveView(rollout, now) {
  const desired = rollout.desiredCount;

  if (rollout.stoppedAt) {
    const ratio = progressRatio(rollout, rollout.stoppedAt - rollout.createdAt);
    const running = Math.floor(desired * ratio);
    return {
      phase: "FAILED",
      rolloutState: "FAILED",
      reason:
        "ECS deployment failed: rolled back to the previous task definition.",
      serviceDeploymentStatus: "STOPPED",
      runningCount: running,
      pendingCount: 0,
      failedTasks: Math.max(desired - running, 0),
    };
  }

  const elapsed = now - rollout.createdAt;
  const ratio = progressRatio(rollout, elapsed);

  if (ratio < 1) {
    const running = Math.floor(desired * ratio);
    return {
      phase: "IN_PROGRESS",
      rolloutState: "IN_PROGRESS",
      reason:
        rollout.outcome === "hang"
          ? "ECS deployment in progress: waiting for tasks to reach a healthy state."
          : "ECS deployment in progress.",
      serviceDeploymentStatus: "IN_PROGRESS",
      runningCount: running,
      pendingCount: desired - running,
      failedTasks: 0,
    };
  }

  if (rollout.outcome === "failed") {
    return {
      phase: "FAILED",
      rolloutState: "FAILED",
      reason:
        "ECS deployment circuit breaker: tasks failed to reach a healthy state.",
      serviceDeploymentStatus: "FAILED",
      runningCount: 0,
      pendingCount: 0,
      failedTasks: desired,
    };
  }

  return {
    phase: "COMPLETED",
    rolloutState: "COMPLETED",
    reason: "ECS deployment completed.",
    serviceDeploymentStatus: "SUCCESSFUL",
    runningCount: desired,
    pendingCount: 0,
    failedTasks: 0,
  };
}

function buildServiceOutput(state, now) {
  const rollouts = state.rollouts.slice(0, HISTORY_LIMIT);
  const primaryView = deriveView(rollouts[0], now);

  const deployments = rollouts.map((rollout, idx) => {
    const view = deriveView(rollout, now);
    let status;
    if (idx === 0) status = "PRIMARY";
    else if (idx === 1 && primaryView.phase !== "COMPLETED") status = "ACTIVE";
    else status = "INACTIVE";
    const serving = status !== "INACTIVE";

    return {
      id: rollout.id,
      status,
      taskDefinition: rollout.taskDefinitionArn,
      desiredCount: rollout.desiredCount,
      pendingCount: serving ? view.pendingCount : 0,
      runningCount: serving ? view.runningCount : 0,
      failedTasks: view.failedTasks,
      createdAt: epochSeconds(rollout.createdAt),
      updatedAt: epochSeconds(now),
      launchType: "EC2",
      rolloutState: view.rolloutState,
      rolloutStateReason: view.reason,
    };
  });

  return {
    serviceArn: serviceArn(state.cluster, state.service),
    serviceName: state.service,
    clusterArn: clusterArn(state.cluster),
    status: "ACTIVE",
    desiredCount: state.desiredCount,
    runningCount: deployments.reduce((sum, d) => sum + d.runningCount, 0),
    pendingCount: deployments.reduce((sum, d) => sum + d.pendingCount, 0),
    launchType: "EC2",
    taskDefinition: rollouts[0].taskDefinitionArn,
    deploymentConfiguration: {
      deploymentCircuitBreaker: { enable: false, rollback: false },
      maximumPercent: 200,
      minimumHealthyPercent: 100,
    },
    deployments,
    roleArn: "",
    events: [],
    createdAt: epochSeconds(state.createdAt),
    networkConfiguration: {},
    healthCheckGracePeriodSeconds: 0,
    schedulingStrategy: "REPLICA",
    deploymentController: { type: "ECS" },
    tags: [],
    createdBy: "arn:aws:iam::000000000000:root",
    enableECSManagedTags: false,
    propagateTags: "NONE",
    enableExecuteCommand: false,
  };
}

// --- ECS アクション -----------------------------------------------------

const actions = {
  CreateCluster(input) {
    const name = input.clusterName;
    clusters.add(name);
    return {
      cluster: { clusterArn: clusterArn(name), clusterName: name, status: "ACTIVE" },
    };
  },

  // init スクリプトの起動待ちチェックにのみ使う (readiness probe)。
  ListClusters() {
    return { clusterArns: Array.from(clusters, clusterArn) };
  },

  RegisterTaskDefinition(input) {
    const family = input.family;
    if (!family) {
      throw new ApiError(400, "InvalidParameterException", "family is required");
    }
    const revisions = taskDefinitions.get(family) || [];
    const revision = revisions.length + 1;
    const completed = completeTaskDefinition(input);
    const stored = {
      ...completed,
      family,
      revision,
      taskDefinitionArn: taskDefinitionArn(family, revision),
      status: "ACTIVE",
      registeredAt: epochSeconds(Date.now()),
      requiresAttributes: [],
      compatibilities: completed.requiresCompatibilities || ["EC2"],
    };
    revisions.push(stored);
    taskDefinitions.set(family, revisions);
    return { taskDefinition: stored };
  },

  DescribeTaskDefinition(input) {
    const found = resolveTaskDefinition(input.taskDefinition);
    if (!found) {
      throw new ApiError(
        400,
        "ClientException",
        `Unable to describe task definition: ${input.taskDefinition}`,
      );
    }
    return { taskDefinition: found };
  },

  CreateService(input) {
    const { cluster, serviceName, taskDefinition, desiredCount } = input;
    clusters.add(cluster);
    const key = serviceKey(cluster, serviceName);
    const existing = services.get(key);
    if (existing) {
      return { service: buildServiceOutput(existing, Date.now()) };
    }
    const resolved = resolveTaskDefinition(taskDefinition);
    if (!resolved) {
      throw new ApiError(
        400,
        "ClientException",
        `Unable to resolve task definition: ${taskDefinition}`,
      );
    }
    // 初回起動は待たされてもうれしくないので、ほぼ即座に COMPLETED にする。
    const rollout = createRollout({
      cluster,
      service: serviceName,
      taskDefinitionArn: resolved.taskDefinitionArn,
      previousTaskDefinitionArn: null,
      desiredCount: desiredCount ?? 1,
      forceOutcome: "success",
      forceDurationMs: 1,
    });
    const state = {
      cluster,
      service: serviceName,
      desiredCount: desiredCount ?? 1,
      createdAt: Date.now(),
      rollouts: [rollout],
    };
    services.set(key, state);
    return { service: buildServiceOutput(state, Date.now()) };
  },

  DescribeServices(input) {
    const { cluster, services: names } = input;
    const results = [];
    const failures = [];
    for (const name of names || []) {
      const state = services.get(serviceKey(cluster, name));
      if (!state) {
        failures.push({ arn: serviceArn(cluster, name), reason: "MISSING" });
        continue;
      }
      results.push(buildServiceOutput(state, Date.now()));
    }
    return { services: results, failures };
  },

  UpdateService(input) {
    const { cluster, service, taskDefinition, desiredCount } = input;
    const key = serviceKey(cluster, service);
    const state = services.get(key);
    if (!state) {
      throw new ApiError(400, "ServiceNotFoundException", `Service not found: ${service}`);
    }
    const resolved = resolveTaskDefinition(taskDefinition);
    if (!resolved) {
      throw new ApiError(
        400,
        "ClientException",
        `Unable to resolve task definition: ${taskDefinition}`,
      );
    }
    if (typeof desiredCount === "number") {
      state.desiredCount = desiredCount;
    }
    const previousArn = state.rollouts[0].taskDefinitionArn;
    const rollout = createRollout({
      cluster,
      service,
      taskDefinitionArn: resolved.taskDefinitionArn,
      previousTaskDefinitionArn: previousArn,
      desiredCount: state.desiredCount,
    });
    state.rollouts.unshift(rollout);
    state.rollouts.length = Math.min(state.rollouts.length, HISTORY_LIMIT);
    return { service: buildServiceOutput(state, Date.now()) };
  },

  ListServiceDeployments(input) {
    const { cluster, service } = input;
    const state = services.get(serviceKey(cluster, service));
    if (!state) return { serviceDeployments: [] };
    const now = Date.now();
    const serviceDeployments = state.rollouts.slice(0, HISTORY_LIMIT).map((rollout) => {
      const view = deriveView(rollout, now);
      return {
        serviceDeploymentArn: rollout.serviceDeploymentArn,
        serviceArn: serviceArn(cluster, service),
        clusterArn: clusterArn(cluster),
        createdAt: epochSeconds(rollout.createdAt),
        startedAt: epochSeconds(rollout.createdAt),
        finishedAt:
          view.phase === "IN_PROGRESS" ? undefined : epochSeconds(now),
        updatedAt: epochSeconds(now),
        status: view.serviceDeploymentStatus,
        statusReason: view.reason,
        targetServiceRevision: { arn: rollout.taskDefinitionArn },
      };
    });
    return { serviceDeployments };
  },

  StopServiceDeployment(input) {
    const { serviceDeploymentArn: arn } = input;
    for (const state of services.values()) {
      const primary = state.rollouts[0];
      if (primary.serviceDeploymentArn !== arn) continue;
      const view = deriveView(primary, Date.now());
      if (view.phase !== "IN_PROGRESS") {
        throw new ApiError(
          400,
          "InvalidParameterException",
          "Deployment is not in progress and cannot be stopped.",
        );
      }
      primary.stoppedAt = Date.now();
      const rollback = createRollout({
        cluster: state.cluster,
        service: state.service,
        taskDefinitionArn: primary.previousTaskDefinitionArn || primary.taskDefinitionArn,
        previousTaskDefinitionArn: primary.taskDefinitionArn,
        desiredCount: state.desiredCount,
        forceOutcome: "success",
        forceDurationMs: ROLLBACK_DURATION_MS,
      });
      state.rollouts.unshift(rollback);
      state.rollouts.length = Math.min(state.rollouts.length, HISTORY_LIMIT);
      return { serviceDeploymentArn: arn };
    }
    throw new ApiError(
      400,
      "ServiceDeploymentNotFoundException",
      `No matching service deployment found for ${arn}`,
    );
  },
};

class ApiError extends Error {
  constructor(status, type, message) {
    super(message);
    this.status = status;
    this.type = type;
  }
}

// --- 制御用エンドポイント (非 AWS プロトコル、docs/local-verification.md 参照) ---
// 次回の UpdateService の結果 (success/hang/failed) と所要時間を強制する。
// hang を明示的に発生させてロールバック操作を確実に試したいときに使う。

function handleControlRequest(req, res, url, body) {
  if (req.method === "POST" && url.pathname === "/_sim/next-deployment") {
    const { cluster, service, outcome, durationMs } = body || {};
    if (!cluster || !service || !["success", "hang", "failed"].includes(outcome)) {
      return sendControlJson(res, 400, {
        error: "cluster, service and outcome ('success'|'hang'|'failed') are required",
      });
    }
    // durationMs は truthy 判定だと 0 を指定できないうえ NaN/負数がすり抜けるので、
    // 与えられた場合は正の有限数であることを検証する。
    let parsedDurationMs;
    if (durationMs !== undefined && durationMs !== null) {
      parsedDurationMs = Number(durationMs);
      if (!Number.isFinite(parsedDurationMs) || parsedDurationMs <= 0) {
        return sendControlJson(res, 400, {
          error: "durationMs must be a positive finite number",
        });
      }
    }
    forcedNext.set(serviceKey(cluster, service), {
      outcome,
      durationMs: parsedDurationMs,
    });
    return sendControlJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/_sim/state") {
    const now = Date.now();
    const dump = {};
    for (const [key, state] of services) {
      dump[key] = buildServiceOutput(state, now);
    }
    return sendControlJson(res, 200, { services: dump });
  }

  return sendControlJson(res, 404, { error: "not found" });
}

// AWS JSON 1.1 プロトコル (ECS API) のレスポンス用。
function sendAwsJson(res, status, body) {
  sendJson(res, status, body, "application/x-amz-json-1.1");
}

// /_sim/* 制御用エンドポイント (非 AWS プロトコル) のレスポンス用。
// AWS プロトコルと同じ Content-Type を使うとツール/デバッグ時に紛らわしいため分ける。
function sendControlJson(res, status, body) {
  sendJson(res, status, body, "application/json; charset=utf-8");
}

function sendJson(res, status, body, contentType) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const target = req.headers["x-amz-target"];

    if (!target) {
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }
      console.log(`${req.method} ${url.pathname}`);
      return handleControlRequest(req, res, url, body);
    }

    const action = String(target).split(".").pop();
    console.log(`ECS ${action}`);
    const handler = actions[action];
    if (!handler) {
      return sendAwsJson(res, 400, {
        __type: "UnknownOperationException",
        message: `Unsupported action: ${action}`,
      });
    }

    try {
      const input = raw ? JSON.parse(raw) : {};
      const output = handler(input);
      return sendAwsJson(res, 200, output);
    } catch (error) {
      if (error instanceof ApiError) {
        return sendAwsJson(res, error.status, {
          __type: error.type,
          message: error.message,
        });
      }
      console.error(error);
      return sendAwsJson(res, 500, {
        __type: "InternalFailure",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`ecs-sim listening on :${PORT} (region: ${REGION})`);
});
