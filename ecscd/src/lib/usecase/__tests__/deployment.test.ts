import { ApplicationDomain } from "../../domain/application";
import { ApplicationRepository } from "../../repository/application";
import { DeploymentRepository } from "../../repository/deployment";
import { DeploymentUsecase } from "../deployment";

function createTestApplication(): ApplicationDomain {
  const now = new Date("2026-04-08T00:00:00.000Z");

  return {
    name: "test-app",
    gitConfig: {
      repo: "https://github.com/test/repo",
      branch: "main",
      path: "task-definition.json",
    },
    ecsConfig: { cluster: "test-cluster", service: "test-service" },
    awsConfig: { region: "us-east-1", externalId: "test-external-id" },
    createdAt: now,
    updatedAt: now,
  };
}

describe("DeploymentUsecase.syncService", () => {
  let deploymentRepository: jest.Mocked<DeploymentRepository>;
  let applicationRepository: jest.Mocked<ApplicationRepository>;
  let usecase: DeploymentUsecase;

  beforeEach(() => {
    deploymentRepository = {
      syncService: jest.fn(),
      rollback: jest.fn(),
    } as unknown as jest.Mocked<DeploymentRepository>;
    applicationRepository = {
      updateLastSyncedAt: jest.fn(),
    } as unknown as jest.Mocked<ApplicationRepository>;
    usecase = new DeploymentUsecase(deploymentRepository, applicationRepository);
  });

  it("sync 後に最終 Sync 時刻を永続化する", async () => {
    deploymentRepository.syncService.mockResolvedValue(undefined);
    applicationRepository.updateLastSyncedAt.mockResolvedValue(undefined);

    await usecase.syncService(createTestApplication());

    expect(applicationRepository.updateLastSyncedAt).toHaveBeenCalledWith(
      "test-app",
      expect.any(Date),
    );
  });

  it("sync 自体が失敗したら最終 Sync 時刻は更新せず例外を伝える", async () => {
    deploymentRepository.syncService.mockRejectedValue(new Error("sync failed"));

    await expect(usecase.syncService(createTestApplication())).rejects.toThrow(
      "sync failed",
    );
    expect(applicationRepository.updateLastSyncedAt).not.toHaveBeenCalled();
  });

  it("最終 Sync 時刻の永続化に失敗しても sync は成功として扱う", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    deploymentRepository.syncService.mockResolvedValue(undefined);
    applicationRepository.updateLastSyncedAt.mockRejectedValue(new Error("db down"));

    await expect(
      usecase.syncService(createTestApplication()),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
