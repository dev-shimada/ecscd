import {
  ApplicationDomain,
  EcsRolloutState,
  ObservedApplicationDomain,
  getApplicationStatus,
} from "../application";

const now = new Date("2026-04-08T00:00:00.000Z");

const base: ApplicationDomain = {
  name: "test-app",
  gitConfig: { repo: "https://github.com/test/repo", branch: "main", path: "task-definition.json" },
  ecsConfig: { cluster: "test-cluster", service: "test-service" },
  awsConfig: { region: "us-east-1", externalId: "test-external-id" },
  createdAt: now,
  updatedAt: now,
};

function observed(
  rolloutState: EcsRolloutState | undefined,
  overrides: Partial<ObservedApplicationDomain> = {},
  rolloutStateReason = "",
): ObservedApplicationDomain {
  return {
    ...base,
    observedAt: now,
    sync: { status: "Success", value: { status: "InSync" } },
    diff: { status: "Success", value: [] },
    service: {
      status: "Success",
      value: {
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "td:1",
        deployments: [
          {
            status: "PRIMARY",
            createdAt: now,
            updatedAt: now,
            rolloutState,
            rolloutStateReason,
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("getApplicationStatus", () => {
  it("rolloutState が無い (CODE_DEPLOY / EXTERNAL) 場合は Failed にせず sync 状態へフォールバックする", () => {
    expect(getApplicationStatus(observed(undefined))).toEqual({ status: "InSync" });
  });

  it("COMPLETED は sync 状態をそのまま反映する", () => {
    const app = observed("COMPLETED", {
      sync: { status: "Success", value: { status: "OutOfSync" } },
    });
    expect(getApplicationStatus(app)).toEqual({ status: "OutOfSync" });
  });

  it("デプロイ中に sync/diff の取得が失敗しても Deploying のままにする", () => {
    const app = observed(
      "IN_PROGRESS",
      {
        sync: { status: "Error", reason: "rate limited" },
        diff: { status: "Error", reason: "rate limited" },
      },
      "ECS deployment in progress",
    );
    expect(getApplicationStatus(app)).toEqual({
      status: "Deploying",
      reason: "ECS deployment in progress",
    });
  });

  it("デプロイ失敗は sync エラーより優先して Failed にする", () => {
    const app = observed(
      "FAILED",
      { sync: { status: "Error", reason: "rate limited" } },
      "tasks failed to start",
    );
    expect(getApplicationStatus(app)).toEqual({
      status: "Failed",
      reason: "tasks failed to start",
    });
  });

  it("デプロイ中でなければ sync エラーは Error になる", () => {
    const app = observed("COMPLETED", {
      sync: { status: "Error", reason: "rate limited" },
    });
    expect(getApplicationStatus(app)).toEqual({
      status: "Error",
      reason: "rate limited",
    });
  });
});
