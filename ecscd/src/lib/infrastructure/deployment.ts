import { IAws } from "./interface/aws";
import {
  GitTaskDefinitionError,
  IGithub,
} from "./interface/github";
import { ApplicationDomain, ServiceDomain } from "../domain/application";
import { TaskDefinitionSpec } from "../domain/task-definition";
import {
  DeploymentRepository,
  TaskDefinitionsForDiff,
} from "../repository/deployment";

export class Deployment implements DeploymentRepository {
  constructor(private aws: IAws, private github: IGithub) {}

  private async resolveTargetTaskDefinition(
    application: ApplicationDomain
  ): Promise<TaskDefinitionSpec> {
    const result = await this.github.getTaskDefinition(application.gitConfig);
    if (result.status === "Error") {
      throw new Error(formatGitTaskDefinitionError(result.error));
    }
    return result.taskDefinition;
  }

  async syncService(application: ApplicationDomain): Promise<void> {
    const taskDefinition = await this.resolveTargetTaskDefinition(application);
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
    const taskDefinition = await this.resolveTargetTaskDefinition(application);
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

function formatGitTaskDefinitionError(error: GitTaskDefinitionError): string {
  switch (error.type) {
    case "InvalidRepositoryUrl":
      return `Invalid GitHub repository URL: "${error.url}"`;
    case "CommitNotFound":
      return `No commits found on branch "${error.branch}".`;
    case "FileNotFound":
      return `Task definition file not found at "${error.path}".`;
    case "InvalidTaskDefinition":
      return `Invalid task definition: ${error.reason}`;
    case "FetchFailed":
      return `Failed to fetch task definition from GitHub: ${error.reason}`;
  }
}
