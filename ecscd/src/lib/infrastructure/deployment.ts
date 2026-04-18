import { IAws } from "./interface/aws";
import { IGithub } from "./interface/github";
import { ApplicationDomain, ServiceDomain } from "../domain/application";
import {
  DeploymentRepository,
  TaskDefinitionsForDiff,
} from "../repository/deployment";

export class Deployment implements DeploymentRepository {
  constructor(private aws: IAws, private github: IGithub) {}
  async syncService(application: ApplicationDomain): Promise<void> {
    const taskDefinition = await this.github.getFileContent(application);
    if (!taskDefinition) {
      throw new Error("Task definition file not found");
    }
    const taskDefinitionArn = await this.aws.registerTaskDefinition(
      application.awsConfig,
      taskDefinition
    );
    await this.aws.updateService(
      application.awsConfig,
      application.ecsConfig,
      taskDefinitionArn
    );
  }

  async rollback(application: ApplicationDomain): Promise<void> {
    await this.aws.stopServiceDeployment(
      application.awsConfig,
      application.ecsConfig
    );
  }

  async getTaskDefinitionsForDiff(
    application: ApplicationDomain,
    service?: ServiceDomain,
  ): Promise<TaskDefinitionsForDiff> {
    const taskDefinition = await this.github.getFileContent(application);
    if (!taskDefinition) {
      throw new Error("Task definition file not found");
    }
    const currentService =
      service ||
      (await this.aws.describeServices(
        application.awsConfig,
        application.ecsConfig
      ));
    if (!currentService) {
      throw new Error("ECS Service not found");
    }
    const currentTaskDefArn = currentService.taskDefinition;
    if (!currentTaskDefArn) {
      throw new Error("Current task definition ARN not found");
    }
    const currentTaskDef = await this.aws.describeTaskDefinition(
      application.awsConfig,
      currentTaskDefArn
    );
    if (!currentTaskDef) {
      throw new Error("Current task definition not found");
    }

    return {
      current: currentTaskDef,
      target: taskDefinition,
    };
  }
}
