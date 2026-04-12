import {
  ApplicationDomain,
  ApplicationSyncStatus,
  createLoadingResource,
} from "../domain/application";
import { ApplicationRepository } from "../repository/application";
import { DeploymentRepository } from "../repository/deployment";

export interface IApplicationUsecase {
  getApplications(): Promise<ApplicationDomain[]>;
  getApplicationNames(): Promise<string[]>;
  getApplication(name: string): Promise<ApplicationDomain | null>;
  fetchService(application: ApplicationDomain): Promise<ApplicationDomain>;
  resolveApplication(application: ApplicationDomain): Promise<ApplicationDomain>;
  createApplication(application: ApplicationDomain): Promise<void>;
  updateApplication(application: ApplicationDomain): Promise<void>;
  deleteApplication(name: string): Promise<void>;
}

export class ApplicationUsecase implements IApplicationUsecase {
  constructor(
    private applicationRepository: ApplicationRepository,
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

  async fetchService(application: ApplicationDomain): Promise<ApplicationDomain> {
    return this.applicationRepository.fetchService(application);
  }

  async resolveApplication(application: ApplicationDomain): Promise<ApplicationDomain> {
    const serviceResolvedApplication = await this.fetchService(application);

    if (serviceResolvedApplication.service.status !== "Success") {
      return serviceResolvedApplication;
    }

    const service = serviceResolvedApplication.service.value;
    if (!service || service.status !== "ACTIVE") {
      return serviceResolvedApplication;
    }

    if (serviceResolvedApplication.sync.status === "Error") {
      return serviceResolvedApplication;
    }

    const lastSyncedAt =
      serviceResolvedApplication.sync.status === "Success"
        ? serviceResolvedApplication.sync.value?.lastSyncedAt
        : undefined;

    const loadingApplication: ApplicationDomain = {
      ...serviceResolvedApplication,
      diff: createLoadingResource(),
      sync: createLoadingResource(),
    };

    try {
      const deployments = await this.deploymentRepository.diff(loadingApplication);
      return {
        ...loadingApplication,
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
        ...loadingApplication,
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

  async getApplications(): Promise<ApplicationDomain[]> {
    return this.applicationRepository.getApplications();
  }

  async getApplicationNames(): Promise<string[]> {
    return this.applicationRepository.getApplicationNames();
  }

  async getApplication(name: string): Promise<ApplicationDomain | null> {
    return this.applicationRepository.getApplication(name);
  }

  async createApplication(application: ApplicationDomain): Promise<void> {
    await this.applicationRepository.createApplication(application);
  }
  async updateApplication(application: ApplicationDomain): Promise<void> {
    await this.applicationRepository.updateApplication(application);
  }
  async deleteApplication(name: string): Promise<void> {
    await this.applicationRepository.deleteApplication(name);
  }
}
