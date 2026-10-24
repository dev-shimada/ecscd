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
    // デプロイは既に開始済みなので、最終 Sync 時刻の永続化に失敗しても Sync 自体は
    // 失敗扱いにしない (呼び出し元に例外を返すと、実際には進行中のデプロイが失敗に見える)。
    try {
      await this.applicationRepository.updateLastSyncedAt(
        application.name,
        new Date(),
      );
    } catch (error) {
      console.error(
        `Failed to update last synced at for '${application.name}':`,
        error,
      );
    }
  }

  async rollback(application: ApplicationDomain): Promise<void> {
    await this.deploymentRepository.rollback(application);
  }
}
