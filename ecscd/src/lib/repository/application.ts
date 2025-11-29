import { ApplicationDomain } from "../domain/application";

export interface ApplicationRepository {
  getApplications(): Promise<ApplicationDomain[]>;
  getApplicationNames(): Promise<string[]>;
  getApplication(name: string): Promise<ApplicationDomain | null>;
  getService(
    application: ApplicationDomain
  ): Promise<ApplicationDomain["service"]>;
  createApplication(application: ApplicationDomain): Promise<void>;
  updateApplication(application: ApplicationDomain): Promise<void>;
  deleteApplication(name: string): Promise<void>;
}
