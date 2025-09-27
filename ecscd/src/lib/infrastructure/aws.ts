import {
  ECSClient,
  DescribeServicesCommand,
  ECSClientConfig,
} from "@aws-sdk/client-ecs";
import { ApplicationDomain } from "../domain/application";
import {
  RegisterTaskDefinitionCommand,
  RegisterTaskDefinitionCommandInput,
  DescribeTaskDefinitionCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";
import { IAws } from "./interface/aws";

import {
  STSClient,
  AssumeRoleCommand,
  Credentials,
  STSClientConfig,
} from "@aws-sdk/client-sts";

export class AWS implements IAws {
  private async getCredentials(
    region: ApplicationDomain["awsConfig"]["region"],
    roleArn: ApplicationDomain["awsConfig"]["roleArn"],
    externalId: ApplicationDomain["awsConfig"]["externalId"]
  ): Promise<Credentials | undefined> {
    if (!roleArn) {
      return undefined;
    }
    const stsClientConfig: STSClientConfig = {
      region: region || "us-east-1",
      maxAttempts: 3,
      retryMode: "standard",
    };
    const stsClient = new STSClient(stsClientConfig);
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `ecscd-session-${Date.now()}`,
      ExternalId: externalId,
      DurationSeconds: 3600, // 1 hour
    });

    const response = await stsClient.send(command);
    if (!response.Credentials) {
      throw new Error("Failed to assume role: No credentials returned");
    }

    return response.Credentials;
  }

  async createECSClient(
    awsConfig: ApplicationDomain["awsConfig"]
  ): Promise<ECSClient> {
    const { region, roleArn, externalId } = awsConfig;

    const credentials = await this.getCredentials(region, roleArn, externalId);
    const config: ECSClientConfig = {
      region: region || "us-east-1",
      maxAttempts: 3,
      retryMode: "standard",
      credentials: credentials
        ? {
            accessKeyId: credentials?.AccessKeyId || "",
            secretAccessKey: credentials?.SecretAccessKey || "",
            sessionToken: credentials?.SessionToken || "",
          }
        : undefined,
    };
    return new ECSClient(config);
  }

  async describeServices(
    client: ECSClient,
    ecsConfig: ApplicationDomain["ecsConfig"]
  ): Promise<ApplicationDomain["service"]> {
    const input = {
      cluster: ecsConfig.cluster,
      services: [ecsConfig.service],
    };
    const command = new DescribeServicesCommand(input);
    const response = await client.send(command);
    if (response.failures && response.failures.length > 0) {
      return undefined;
    }
    const service: ApplicationDomain["service"] = {
      status: response.services?.[0]?.status || "INACTIVE",
      desiredCount: response.services?.[0]?.desiredCount || 0,
      runningCount: response.services?.[0]?.runningCount || 0,
      taskDefinition: response.services?.[0]?.taskDefinition || "",
      deployments: (response.services?.[0]?.deployments || []).map((d) => ({
        status: d.status || "INACTIVE",
        rolloutState: d.rolloutState || "FAILED",
        rolloutStateReason: d.rolloutStateReason || "",
        createdAt: d.createdAt || new Date(),
        updatedAt: d.updatedAt || new Date(),
      })),
    };
    return service;
  }

  async describeTaskDefinition(
    client: ECSClient,
    taskDefinitionArn: string
  ): Promise<RegisterTaskDefinitionCommandInput | undefined> {
    const command = new DescribeTaskDefinitionCommand({
      taskDefinition: taskDefinitionArn,
    });
    const response = await client.send(command);
    if (!response.taskDefinition) {
      return undefined;
    }
    return response.taskDefinition as RegisterTaskDefinitionCommandInput;
  }

  async registerTaskDefinition(
    client: ECSClient,
    taskDef: RegisterTaskDefinitionCommandInput
  ): Promise<string> {
    const response = await client.send(
      new RegisterTaskDefinitionCommand(taskDef)
    );
    if (
      !response.taskDefinition ||
      !response.taskDefinition.taskDefinitionArn
    ) {
      throw new Error("Failed to register task definition");
    }
    return response.taskDefinition.taskDefinitionArn;
  }

  async updateService(
    client: ECSClient,
    ecsConfig: ApplicationDomain["ecsConfig"],
    taskDefinitionArn: string
  ): Promise<void> {
    const command = new UpdateServiceCommand({
      cluster: ecsConfig.cluster,
      service: ecsConfig.service,
      taskDefinition: taskDefinitionArn,
    });
    const response = await client.send(command);
    if (!response.service) {
      throw new Error("Failed to update service");
    }
    return;
  }
}
