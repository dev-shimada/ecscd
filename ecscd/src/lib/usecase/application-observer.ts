import {
  ApplicationSyncStatus,
  ApplicationDomain,
  createLoadingObserved,
  ObservedApplicationDomain,
} from "../domain/application";
import { compareTaskDefinitions } from "../domain/task-definition-diff";
import { ApplicationObserver } from "../repository/application-observer";
import { DeploymentRepository } from "../repository/deployment";
import { ServiceStateProvider } from "../repository/service-state-provider";

export class DefaultApplicationObserver implements ApplicationObserver {
  constructor(
    private serviceStateProvider: ServiceStateProvider,
    private deploymentRepository: DeploymentRepository,
  ) {}

  private toDiffErrorReason(error: unknown): string {
    return error instanceof Error
      ? error.message
      : "Failed to compare ECS and GitHub configuration.";
  }

  private toSyncResource(status: ApplicationSyncStatus, lastSyncedAt?: Date) {
    return {
      status: "Success" as const,
      value: {
        status,
        lastSyncedAt,
      },
    };
  }

  async observe(
    application: ApplicationDomain,
  ): Promise<ObservedApplicationDomain> {
    const observedAt = new Date();
    const service = await this.serviceStateProvider.fetchService(application);
    const loadingApplication = createLoadingObserved(
      application,
      observedAt,
    );
    const serviceObservedApplication: ObservedApplicationDomain = {
      ...loadingApplication,
      service,
    };

    if (service.status !== "Success") {
      return serviceObservedApplication;
    }

    if (service.value.status !== "ACTIVE") {
      return serviceObservedApplication;
    }

    // FIXME(review): serviceObservedApplication.sync は直前の createLoadingObserved で
    // { status: "Loading" } に初期化されたばかりなので、この条件は常に false となり
    // lastSyncedAt は常に undefined(UI の "Last Synced" は Sync 直後でも常に "Never")。
    // 直前の観測結果から引き継げる値はここに存在しないため、修正には最終 Sync 時刻の
    // 永続化(例: sync 実行時に DB へ記録し、ここで読み出す)が必要。
    const lastSyncedAt =
      serviceObservedApplication.sync.status === "Success"
        ? serviceObservedApplication.sync.value?.lastSyncedAt
        : undefined;

    try {
      const taskDefinitions =
        await this.deploymentRepository.getTaskDefinitionsForDiff(
          application,
          service.value,
        );
      const deployments = compareTaskDefinitions(
        taskDefinitions.current,
        taskDefinitions.target,
      );
      return {
        ...serviceObservedApplication,
        sync: this.toSyncResource(
          deployments.length > 0 ? "OutOfSync" : "InSync",
          lastSyncedAt,
        ),
        diff: {
          status: "Success",
          value: deployments,
        },
      };
    } catch (error) {
      const reason = this.toDiffErrorReason(error);
      return {
        ...serviceObservedApplication,
        sync: {
          status: "Error",
          reason,
        },
        diff: {
          status: "Error",
          reason,
        },
      };
    }
  }
}
