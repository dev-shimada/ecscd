import { ApplicationDomain } from "../domain/application";

export interface ApplicationRepository {
  getApplications(): Promise<ApplicationDomain[]>;
  getService(
    application: ApplicationDomain
  ): Promise<ApplicationDomain["service"]>;
  createApplication(application: ApplicationDomain): Promise<void>;
  updateApplication(application: ApplicationDomain): Promise<void>;
  deleteApplication(name: string): Promise<void>;
}
