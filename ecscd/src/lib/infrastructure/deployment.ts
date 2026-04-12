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
    const client = await this.aws.createECSClient(application.awsConfig);
    const taskDefinitionArn = await this.aws.registerTaskDefinition(
      client,
      taskDefinition
    );
    await this.aws.updateService(
      client,
      application.ecsConfig,
      taskDefinitionArn
    );
  }

  async rollback(application: ApplicationDomain): Promise<void> {
    const client = await this.aws.createECSClient(application.awsConfig);
    await this.aws.stopServiceDeployment(client, application.ecsConfig);
  }

  async getTaskDefinitionsForDiff(
    application: ApplicationDomain,
    service?: ServiceDomain,
  ): Promise<TaskDefinitionsForDiff> {
    const taskDefinition = await this.github.getFileContent(application);
    if (!taskDefinition) {
      throw new Error("Task definition file not found");
    }
    const client = await this.aws.createECSClient(application.awsConfig);
    const currentService =
      service ||
      (await this.aws.describeServices(client, application.ecsConfig));
    if (!currentService) {
      throw new Error("ECS Service not found");
    }
    const currentTaskDefArn = currentService.taskDefinition;
    if (!currentTaskDefArn) {
      throw new Error("Current task definition ARN not found");
    }
    const currentTaskDef = await this.aws.describeTaskDefinition(
      client,
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
