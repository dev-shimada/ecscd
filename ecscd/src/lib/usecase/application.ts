import {
  ApplicationDomain,
  ApplicationSyncStatus,
  createLoadingResource,
  ServiceDomain,
} from "../domain/application";
import { ApplicationRepository } from "../repository/application";
import { DeploymentRepository } from "../repository/deployment";

export interface IApplicationUsecase {
  getApplicationConfigs(): Promise<ApplicationDomain[]>;
  getApplications(): Promise<ApplicationDomain[]>;
  getApplicationNames(): Promise<string[]>;
  getApplicationConfig(name: string): Promise<ApplicationDomain | null>;
  getApplication(name: string): Promise<ApplicationDomain | null>;
  getService(
    application: ApplicationDomain,
  ): Promise<ServiceDomain | undefined>;
  createApplication(application: ApplicationDomain): Promise<void>;
  updateApplication(application: ApplicationDomain): Promise<void>;
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

  private async resolveApplication(application: ApplicationDomain) {
    if (application.service.status !== "Success") {
      return application;
    }

    const service = application.service.value;
    if (!service || service.status !== "ACTIVE") {
      return application;
    }

    if (application.sync.status === "Error") {
      return application;
    }

    const lastSyncedAt =
      application.sync.status === "Success"
        ? application.sync.value?.lastSyncedAt
        : undefined;

    application.diff = createLoadingResource();
    application.sync = createLoadingResource();

    try {
      const deployments = await this.deploymentRepository.diff(application);
      application.sync = this.toSyncResource(
        deployments.length > 0 ? "OutOfSync" : "InSync",
        lastSyncedAt,
      );
      application.diff = {
        status: "Success",
        value: deployments,
      };
      return application;
    } catch (error) {
      const reason = this.toDiffErrorReason(error);
      application.sync = {
        status: "Error",
        reason,
      };
      application.diff = {
        status: "Error",
        reason,
      };
      return application;
    }
  }

  async getApplicationConfigs(): Promise<ApplicationDomain[]> {
    return this.applicationRepository.getApplicationConfigs();
  }

  async getApplications(): Promise<ApplicationDomain[]> {
    const applications = await this.applicationRepository.getApplications();

    return Promise.all(applications.map((app) => this.resolveApplication(app)));
  }

  async getApplicationNames(): Promise<string[]> {
    return this.applicationRepository.getApplicationNames();
  }

  async getApplicationConfig(name: string): Promise<ApplicationDomain | null> {
    return this.applicationRepository.getApplicationConfig(name);
  }

  async getApplication(name: string): Promise<ApplicationDomain | null> {
    const application = await this.applicationRepository.getApplication(name);
    if (!application) {
      return null;
    }

    return this.resolveApplication(application);
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
  async getService(
    application: ApplicationDomain,
  ): Promise<ServiceDomain | undefined> {
    return this.applicationRepository.getService(application);
  }
}
