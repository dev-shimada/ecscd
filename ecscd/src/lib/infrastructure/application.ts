import { ApplicationRepository } from "../repository/application";
import { ApplicationDomain } from "../domain/application";
import { IDatabase } from "./interface/database";

export class Application implements ApplicationRepository {
  private db: IDatabase;
  constructor(db: IDatabase) {
    this.db = db;
  }

  async getApplications(): Promise<ApplicationDomain[]> {
    return this.db.getApplications();
  }

  async getApplicationNames(): Promise<string[]> {
    return this.db.getApplicationNames();
  }

  async getApplication(name: string): Promise<ApplicationDomain | null> {
    const applications = await this.db.getApplications();
    return applications.find((a) => a.name === name) || null;
  }

  async createApplication(application: ApplicationDomain): Promise<void> {
    await this.db.createApplication(application);
  }
  async updateApplication(application: ApplicationDomain): Promise<void> {
    await this.db.updateApplication(application);
  }
  async deleteApplication(name: string): Promise<void> {
    await this.db.deleteApplication(name);
  }
}
