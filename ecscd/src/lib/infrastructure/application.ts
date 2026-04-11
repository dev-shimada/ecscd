import { ApplicationDomain } from "../domain/application";
import { ApplicationRepository } from "../repository/application";
import { AWS } from "./aws";
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
    const applications = await this.getApplications();
    return applications.find((a) => a.name === name) || null;
  }

  async fetchService(application: ApplicationDomain): Promise<ApplicationDomain> {
    try {
      const aws = new AWS();
      const ecsResponse = await aws.describeServices(
        await aws.createECSClient(application.awsConfig),
        {
          cluster: application.ecsConfig.cluster,
          service: application.ecsConfig.service,
        },
      );
      if (!ecsResponse) {
        return {
          ...application,
          service: {
            status: "Error",
            reason: "Failed to fetch ECS service state.",
          },
        };
      }
      return {
        ...application,
        service: {
          status: "Success",
          value: ecsResponse,
        },
      };
    } catch (error) {
      console.warn(`Error fetching ECS service for ${application.name}:`, error);
      return {
        ...application,
        service: {
          status: "Error",
          reason:
            error instanceof Error
              ? error.message
              : "Failed to fetch ECS service state.",
        },
      };
    }
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
