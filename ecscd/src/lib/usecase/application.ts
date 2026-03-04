import { ApplicationDomain } from "../domain/application";
import { ApplicationRepository } from "../repository/application";
import { DeploymentRepository } from "../repository/deployment";

export interface IApplicationUsecase {
  getApplications(): Promise<ApplicationDomain[]>;
  getApplicationNames(): Promise<string[]>;
  getApplication(name: string): Promise<ApplicationDomain | null>;
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

    // 並列でECS情報とdiff（同期状態）を取得
    await Promise.all(
      applications.map(async (app) => {
        try {
          // ECS情報を取得
          app.service = await this.deploymentRepository.getService(app);

          // diff情報を取得
          const deployments = await this.deploymentRepository.diff(app);
          if (deployments.length > 0) {
            app.sync.status = "OutOfSync";
          } else {
            app.sync.status = "InSync";
          }
        } catch (error) {
          console.warn(`Error fetching info for ${app.name}:`, error);
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

    // ECS情報とdiff（同期状態）を取得
    try {
      // ECS情報を取得
      application.service = await this.deploymentRepository.getService(application);

      // diff情報を取得
      const deployments = await this.deploymentRepository.diff(application);
      if (deployments.length > 0) {
        application.sync.status = "OutOfSync";
      } else {
        application.sync.status = "InSync";
      }
    } catch (error) {
      console.warn(`Error fetching info for ${application.name}:`, error);
      application.sync.status = "Error";
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
}
