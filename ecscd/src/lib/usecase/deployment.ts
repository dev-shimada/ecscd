import { ApplicationDomain, DiffDomain, ServiceDomain } from "../domain/application";
import { DeploymentRepository } from "../repository/deployment";
export interface IDeploymentUsecase {
  syncService(application: ApplicationDomain): Promise<void>;
  rollback(application: ApplicationDomain): Promise<void>;
  diff(application: ApplicationDomain, service?: ServiceDomain): Promise<DiffDomain[]>;
}

export class DeploymentUsecase {
  private deploymentRepository: DeploymentRepository;
  constructor(deploymentRepository: DeploymentRepository) {
    this.deploymentRepository = deploymentRepository;
  }

  async syncService(application: ApplicationDomain): Promise<void> {
    await this.deploymentRepository.syncService(application);
  }

  async rollback(application: ApplicationDomain): Promise<void> {
    await this.deploymentRepository.rollback(application);
  }

  async diff(
    application: ApplicationDomain,
    service?: ServiceDomain,
  ): Promise<DiffDomain[]> {
    return await this.deploymentRepository.diff(application, service);
  }
}
