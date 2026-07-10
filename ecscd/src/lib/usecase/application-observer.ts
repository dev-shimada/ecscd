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

    // 最終 Sync 時刻は DB に永続化された値をそのまま使う (sync 実行時に
    // DeploymentUsecase.syncService が更新する。usecase/deployment.ts 参照)。
    const lastSyncedAt = application.lastSyncedAt;

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
