import { ApplicationDomain, DiffDomain } from "../domain/application";

export interface DeploymentRepository {
  syncService(application: ApplicationDomain): Promise<void>;
  diff(application: ApplicationDomain): Promise<DiffDomain[]>;
}
