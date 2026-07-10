/**
 * observe → sync のエンドツーエンド統合テスト。
 * ECS 側は ministack、GitHub 側はテストプロセス内に立てたスタブ HTTP サーバを使い、
 * GitHub(baseUrl) / Deployment / AwsServiceStateProvider / DefaultApplicationObserver を
 * 本物のワイヤリングで通す:
 *   Git とタスク定義が一致       -> InSync
 *   Git 側にだけ環境変数を追加   -> OutOfSync (+ diff)
 *   syncService 実行             -> 新リビジョンがサービスに反映され InSync に戻る
 */
import { describe, afterAll, beforeAll, expect, it } from "@jest/globals";
import * as http from "http";
import { AddressInfo } from "net";
import { AWS } from "../../src/lib/infrastructure/aws";
import { Deployment } from "../../src/lib/infrastructure/deployment";
import { GitHub } from "../../src/lib/infrastructure/github";
import { AwsServiceStateProvider } from "../../src/lib/infrastructure/service-state-provider";
import { DefaultApplicationObserver } from "../../src/lib/usecase/application-observer";
import {
  BASE_TASK_DEFINITION,
  buildApplication,
  createClusterAndService,
  rawEcsClient,
  uniqueName,
  waitForEcsSim,
  waitForMinistack,
} from "./helpers";

const family = uniqueName("td");

function taskDefinitionJson(extraEnv?: { name: string; value: string }) {
  return {
    ...BASE_TASK_DEFINITION,
    family,
    containerDefinitions: [
      {
        ...BASE_TASK_DEFINITION.containerDefinitions[0],
        ...(extraEnv ? { environment: [extraEnv] } : {}),
      },
    ],
  };
}

describe("observe & sync end-to-end (ministack + in-process GitHub stub)", () => {
  const cluster = uniqueName("cluster");
  const service = uniqueName("service");

  // スタブが返す「Git 上の望ましいタスク定義」。テスト中に差し替える。
  let gitTaskDefinition = taskDefinitionJson();
  let stubServer: http.Server | undefined;

  const aws = new AWS();
  let observer: DefaultApplicationObserver;
  let deployment: Deployment;

  const application = buildApplication({
    name: uniqueName("app"),
    cluster,
    service,
  });

  beforeAll(async () => {
    await waitForMinistack();
    await waitForEcsSim();

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://localhost");
      const json = (status: number, body: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (/^\/repos\/[^/]+\/[^/]+\/commits\/?$/.test(url.pathname)) {
        return json(200, [{ sha: "itest0000000000000000000000000000000000" }]);
      }
      if (/^\/repos\/[^/]+\/[^/]+\/contents\/.+$/.test(url.pathname)) {
        const raw = Buffer.from(JSON.stringify(gitTaskDefinition));
        return json(200, {
          type: "file",
          encoding: "base64",
          content: raw.toString("base64"),
          size: raw.length,
        });
      }
      json(404, { message: "Not Found" });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    stubServer = server;
    const port = (server.address() as AddressInfo).port;

    const github = new GitHub("dummy-token", `http://127.0.0.1:${port}`);
    deployment = new Deployment(aws, github);
    observer = new DefaultApplicationObserver(
      new AwsServiceStateProvider(aws),
      deployment
    );

    const initialArn = await aws.registerTaskDefinition(
      application.awsConfig,
      taskDefinitionJson()
    );
    await createClusterAndService(rawEcsClient(), cluster, service, initialArn);
  });

  afterAll(async () => {
    // beforeAll が途中で失敗すると stubServer が未初期化のままここに来るので、
    // その場合は close を呼ばず (元の失敗原因を隠さないよう) 何もしない。
    if (!stubServer) {
      return;
    }
    await new Promise<void>((resolve, reject) =>
      stubServer!.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it("reports InSync when ECS matches the git task definition", async () => {
    const observed = await observer.observe(application);

    expect(observed.service.status).toBe("Success");
    expect(observed.sync.status).toBe("Success");
    if (observed.sync.status === "Success") {
      expect(observed.sync.value?.status).toBe("InSync");
    }
    if (observed.diff.status === "Success") {
      expect(observed.diff.value).toHaveLength(0);
    }
  });

  it("reports OutOfSync with a diff when git adds an environment variable", async () => {
    gitTaskDefinition = taskDefinitionJson({
      name: "DEPLOYED_FROM",
      value: "git",
    });

    const observed = await observer.observe(application);

    expect(observed.sync.status).toBe("Success");
    if (observed.sync.status === "Success") {
      expect(observed.sync.value?.status).toBe("OutOfSync");
    }
    expect(observed.diff.status).toBe("Success");
    if (observed.diff.status === "Success") {
      expect(observed.diff.value.length).toBeGreaterThan(0);
    }
  });

  it("syncService registers the git revision and returns to InSync", async () => {
    await deployment.syncService(application);

    const serviceState = await aws.describeServices(application.awsConfig, {
      cluster,
      service,
    });
    // sync で登録された新リビジョンがサービスに反映されている
    expect(serviceState?.taskDefinition).toMatch(new RegExp(`${family}:\\d+`));

    const observed = await observer.observe(application);
    expect(observed.sync.status).toBe("Success");
    if (observed.sync.status === "Success") {
      expect(observed.sync.value?.status).toBe("InSync");
    }
  });

  it("surfaces a typed error message for an invalid repository URL", async () => {
    const badRepoApp = {
      ...application,
      gitConfig: { ...application.gitConfig, repo: "not-a-github-url" },
    };

    const observed = await observer.observe(badRepoApp);
    expect(observed.sync.status).toBe("Error");
    if (observed.sync.status === "Error") {
      expect(observed.sync.reason).toContain("Invalid GitHub repository URL");
    }
  });
});
