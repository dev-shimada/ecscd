import {
  ApplicationDomain,
  ObservedApplicationDomain,
} from "../domain/application";
import { ApplicationRepository } from "../repository/application";
import { ApplicationObserver } from "../repository/application-observer";

export interface IApplicationUsecase {
  getApplications(): Promise<ApplicationDomain[]>;
  getApplicationNames(): Promise<string[]>;
  getApplication(name: string): Promise<ApplicationDomain | null>;
  observeApplication(
    application: ApplicationDomain,
  ): Promise<ObservedApplicationDomain>;
  createApplication(application: ApplicationDomain): Promise<void>;
  updateApplication(application: ApplicationDomain): Promise<void>;
  deleteApplication(name: string): Promise<void>;
}

export class ApplicationUsecase implements IApplicationUsecase {
  constructor(
    private applicationRepository: ApplicationRepository,
    private applicationObserver: ApplicationObserver,
  ) {}

  async observeApplication(
    application: ApplicationDomain,
  ): Promise<ObservedApplicationDomain> {
    return this.applicationObserver.observe(application);
  }

  async getApplications(): Promise<ApplicationDomain[]> {
    return this.applicationRepository.getApplications();
  }

  async getApplicationNames(): Promise<string[]> {
    return this.applicationRepository.getApplicationNames();
  }

  async getApplication(name: string): Promise<ApplicationDomain | null> {
    return this.applicationRepository.getApplication(name);
  }

  async createApplication(application: ApplicationDomain): Promise<void> {
    await this.applicationRepository.createApplication(application);
  }
  async updateApplication(application: ApplicationDomain): Promise<void> {
    await this.applicationRepository.updateApplication(application);
  }
  async deleteApplication(name: string): Promise<void> {
    await this.applicationRepository.deleteApplication(name);
  }
}
