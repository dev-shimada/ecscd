import {
  ApplicationDomain,
  ResourceResult,
  ServiceDomain,
} from "../domain/application";
import { ServiceStateProvider } from "../repository/service-state-provider";
import { IAws } from "./interface/aws";

export class AwsServiceStateProvider implements ServiceStateProvider {
  constructor(private aws: IAws) {}

  async fetchService(
    application: ApplicationDomain,
  ): Promise<ResourceResult<ServiceDomain>> {
    try {
      const ecsResponse = await this.aws.describeServices(
        application.awsConfig,
        application.ecsConfig,
      );

      if (!ecsResponse) {
        return {
          status: "Error",
          reason: "Failed to fetch ECS service state.",
        };
      }

      return {
        status: "Success",
        value: ecsResponse,
      };
    } catch (error) {
      console.warn(`Error fetching ECS service for ${application.name}:`, error);
      return {
        status: "Error",
        reason:
          error instanceof Error
            ? error.message
            : "Failed to fetch ECS service state.",
      };
    }
  }
}
