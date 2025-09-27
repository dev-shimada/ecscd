import { ApplicationDomain, DiffDomain } from "../domain/application";
import { DeploymentRepository } from "../repository/deployment";
export interface IDeploymentUsecase {
  syncService(application: ApplicationDomain): Promise<void>;
  diff(application: ApplicationDomain): Promise<DiffDomain[]>;
}

export class DeploymentUsecase {
  private deploymentRepository: DeploymentRepository;
  constructor(deploymentRepository: DeploymentRepository) {
    this.deploymentRepository = deploymentRepository;
  }

  async syncService(application: ApplicationDomain): Promise<void> {
    await this.deploymentRepository.syncService(application);
  }
  async diff(application: ApplicationDomain): Promise<DiffDomain[]> {
    return await this.deploymentRepository.diff(application);
  }
}
