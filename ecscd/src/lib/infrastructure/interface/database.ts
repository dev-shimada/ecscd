import { ApplicationDomain } from "../../domain/application";

export interface IDatabase {
  getApplications(): Promise<ApplicationDomain[]>;
  createApplication(application: ApplicationDomain): Promise<void>;
  updateApplication(application: ApplicationDomain): Promise<void>;
  deleteApplication(name: string): Promise<void>;
}
