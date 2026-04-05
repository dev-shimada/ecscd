import { ApplicationDomain } from "../domain/application";

export interface ApplicationRepository {
  getApplicationConfigs(): Promise<ApplicationDomain[]>;
  getApplications(): Promise<ApplicationDomain[]>;
  getApplicationNames(): Promise<string[]>;
  getApplicationConfig(name: string): Promise<ApplicationDomain | null>;
  getApplication(name: string): Promise<ApplicationDomain | null>;
  getService(
    application: ApplicationDomain
  ): Promise<ApplicationDomain["service"]>;
  createApplication(application: ApplicationDomain): Promise<void>;
  updateApplication(application: ApplicationDomain): Promise<void>;
  deleteApplication(name: string): Promise<void>;
}
