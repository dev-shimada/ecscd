import { ApplicationDomain } from "../domain/application";
import { ApplicationRepository } from "../repository/application";
import { DeploymentRepository } from "../repository/deployment";

export interface IApplicationUsecase {
  getApplications(): Promise<ApplicationDomain[]>;
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
    for (const app of applications) {
      try {
        const deployments = await this.deploymentRepository.diff(app);
        if (deployments.length > 0) {
          app.sync.status = "OutOfSync";
        } else if (app.sync.status !== "Error") {
          app.sync.status = "Synced";
        }
      } catch {
        app.sync.status = "Error"
      }
    }
    return applications;
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
