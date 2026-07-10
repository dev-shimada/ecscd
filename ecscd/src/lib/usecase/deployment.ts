import { ApplicationDomain } from "../domain/application";
import { ApplicationRepository } from "../repository/application";
import { DeploymentRepository } from "../repository/deployment";
export interface IDeploymentUsecase {
  syncService(application: ApplicationDomain): Promise<void>;
  rollback(application: ApplicationDomain): Promise<void>;
}

export class DeploymentUsecase {
  private deploymentRepository: DeploymentRepository;
  private applicationRepository: ApplicationRepository;
  constructor(
    deploymentRepository: DeploymentRepository,
    applicationRepository: ApplicationRepository,
  ) {
    this.deploymentRepository = deploymentRepository;
    this.applicationRepository = applicationRepository;
  }

  async syncService(application: ApplicationDomain): Promise<void> {
    await this.deploymentRepository.syncService(application);
    await this.applicationRepository.updateLastSyncedAt(
      application.name,
      new Date(),
    );
  }

  async rollback(application: ApplicationDomain): Promise<void> {
    await this.deploymentRepository.rollback(application);
  }
}
