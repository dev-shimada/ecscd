import { ApplicationDomain, ServiceDomain } from "../domain/application";
import { ApplicationRepository } from "../repository/application";
import { AWS } from "./aws";
import { IDatabase } from "./interface/database";

export class Application implements ApplicationRepository {
  private db: IDatabase;
  constructor(db: IDatabase) {
    this.db = db;
  }

  async getApplicationConfigs(): Promise<ApplicationDomain[]> {
    return this.db.getApplications();
  }

  async getApplications(): Promise<ApplicationDomain[]> {
    const applications = await this.getApplicationConfigs();

    // 並列でECSサービス情報を取得
    return Promise.all(
      applications.map(async (app) => {
        try {
          const aws = new AWS();
          const ecsResponse = await aws.describeServices(
            await aws.createECSClient(app.awsConfig),
            {
              cluster: app.ecsConfig.cluster,
              service: app.ecsConfig.service,
            },
          );
          if (!ecsResponse) {
            app.service = {
              status: "Error",
              reason: "Failed to fetch ECS service state.",
            };
            return app;
          }
          app.service = {
            status: "Success",
            value: ecsResponse,
          };
          return app;
        } catch (error) {
          console.warn(`Error fetching ECS service for ${app.name}:`, error);
          app.service = {
            status: "Error",
            reason:
              error instanceof Error
                ? error.message
                : "Failed to fetch ECS service state.",
          };
          return app;
        }
      }),
    );
  }

  async getApplicationNames(): Promise<string[]> {
    return this.db.getApplicationNames();
  }

  async getApplicationConfig(name: string): Promise<ApplicationDomain | null> {
    const applications = await this.getApplicationConfigs();
    return applications.find((a) => a.name === name) || null;
  }

  async getApplication(name: string): Promise<ApplicationDomain | null> {
    const app = await this.getApplicationConfig(name);
    if (!app) {
      return null;
    }

    // ECSサービス情報を取得
    try {
      const aws = new AWS();
      const ecsResponse = await aws.describeServices(
        await aws.createECSClient(app.awsConfig),
        {
          cluster: app.ecsConfig.cluster,
          service: app.ecsConfig.service,
        },
      );
      if (!ecsResponse) {
        app.service = {
          status: "Error",
          reason: "Failed to fetch ECS service state.",
        };
        return app;
      }
      app.service = {
        status: "Success",
        value: ecsResponse,
      };
      return app;
    } catch (error) {
      console.warn(`Error fetching ECS service for ${app.name}:`, error);
      app.service = {
        status: "Error",
        reason:
          error instanceof Error
            ? error.message
            : "Failed to fetch ECS service state.",
      };
      return app;
    }
  }

  async getService(
    application: ApplicationDomain,
  ): Promise<ServiceDomain | undefined> {
    const applications = await this.db.getApplications();
    const appIndex = applications.findIndex(
      (app) => app.name === application.name,
    );
    if (appIndex === -1) {
      throw new Error("Application not found");
    }
    return applications[appIndex].service.status === "Success"
      ? applications[appIndex].service.value
      : undefined;
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
