import { ApplicationDomain } from "../domain/application";
import { ApplicationRepository } from "../repository/application";
import { DeploymentRepository } from "../repository/deployment";

export interface IApplicationUsecase {
  getApplications(): Promise<ApplicationDomain[]>;
  getApplicationNames(): Promise<string[]>;
  getApplication(name: string): Promise<ApplicationDomain | null>;
  getService(
    application: ApplicationDomain
  ): Promise<ApplicationDomain["service"]>;
  createApplication(application: ApplicationDomain): Promise<void>;
  updateApplication(application: ApplicationDomain): Promise<void>;
}

export class ApplicationUsecase implements IApplicationUsecase {
  constructor(
    private applicationRepository: ApplicationRepository,
    private deploymentRepository: DeploymentRepository
  ) {}

  async getApplications(): Promise<ApplicationDomain[]> {
    const applications = await this.applicationRepository.getApplications();

    // 並列でdiff（同期状態）を取得
    // 既にErrorステータスのアプリはスキップ
    await Promise.all(
      applications.map(async (app) => {
        if (app.sync.status === "Error") {
          return;
        }
        try {
          const deployments = await this.deploymentRepository.diff(app);
          if (deployments.length > 0) {
            app.sync.status = "OutOfSync";
          } else {
            app.sync.status = "InSync";
          }
        } catch {
          app.sync.status = "Error";
        }
      })
    );
    return applications;
  }

  async getApplicationNames(): Promise<string[]> {
    return this.applicationRepository.getApplicationNames();
  }

  async getApplication(name: string): Promise<ApplicationDomain | null> {
    const application = await this.applicationRepository.getApplication(name);
    if (!application) {
      return null;
    }

    // diff（同期状態）を取得
    if (application.sync.status !== "Error") {
      try {
        const deployments = await this.deploymentRepository.diff(application);
        if (deployments.length > 0) {
          application.sync.status = "OutOfSync";
        } else {
          application.sync.status = "InSync";
        }
      } catch {
        application.sync.status = "Error";
      }
    }

    return application;
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
    application: ApplicationDomain
  ): Promise<ApplicationDomain["service"]> {
    return this.applicationRepository.getService(application);
  }
}
