import { ApplicationDomain, DiffDomain, ServiceDomain } from "../domain/application";

export interface DeploymentRepository {
  syncService(application: ApplicationDomain): Promise<void>;
  rollback(application: ApplicationDomain): Promise<void>;
  diff(application: ApplicationDomain, service?: ServiceDomain): Promise<DiffDomain[]>;
}
