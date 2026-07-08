import {
  ECSClient,
  DescribeServicesCommand,
  ECSClientConfig,
  RegisterTaskDefinitionCommand,
  RegisterTaskDefinitionCommandInput,
  DescribeTaskDefinitionCommand,
  UpdateServiceCommand,
  ListServiceDeploymentsCommand,
  StopServiceDeploymentCommand,
} from "@aws-sdk/client-ecs";
import {
  ApplicationDomain,
  EcsDeploymentStatus,
  EcsRolloutState,
  EcsServiceStatus,
  ServiceDomain,
} from "../domain/application";
import { TaskDefinitionSpec } from "../domain/task-definition";
import { IAws } from "./interface/aws";
import { toTaskDefinitionSpec } from "./task-definition-normalizer";

import {
  STSClient,
  AssumeRoleCommand,
  Credentials,
  STSClientConfig,
} from "@aws-sdk/client-sts";

function normalizeRolloutStateReason(
  rolloutState: string | undefined,
  reason: string | undefined
) {
  // FIXME(review): FAILED 以外で reason を空文字に潰すため、main が透過していた
  // IN_PROGRESS の理由(例: サーキットブレーカーの "rolling back to deploymentId X")が
  // UI に届かず、domain/application.ts の Deploying 時の rolloutStateReason
  // フォールバックが死にコード化する。ロールバック進行中の検知手段も失われる。
  // 修正例: 状態に依らず透過する
  //   return reason?.trim() || "";
  if (rolloutState !== "FAILED") {
    return "";
  }

  return reason?.trim() || "";
}

function toEcsServiceStatus(status: string | undefined): EcsServiceStatus {
  if (status === "ACTIVE" || status === "DRAINING" || status === "INACTIVE") {
    return status;
  }

  return "INACTIVE";
}

function toEcsDeploymentStatus(status: string | undefined): EcsDeploymentStatus {
  if (status === "PRIMARY" || status === "ACTIVE" || status === "INACTIVE") {
    return status;
  }

  return "INACTIVE";
}

function toEcsRolloutState(status: string | undefined): EcsRolloutState {
  if (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "IN_PROGRESS"
  ) {
    return status;
  }

  // FIXME(review): rolloutState を持たない CODE_DEPLOY / EXTERNAL デプロイメント
  // コントローラのサービスでは undefined がここで "FAILED" になり、
  // getApplicationStatus がヘッドライン状態として恒久的に "Failed"
  // ("The last deployment failed.") を表示する。
  // 修正例: ドメイン側を rolloutState?: EcsRolloutState にして undefined を透過し、
  // IN_PROGRESS / FAILED 判定をスキップさせる(sync 由来の状態にフォールバック)。
  return "FAILED";
}

function toRegisterTaskDefinitionInput(
  spec: TaskDefinitionSpec,
): RegisterTaskDefinitionCommandInput {
  return spec as RegisterTaskDefinitionCommandInput;
}

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

  private async createEcsClient(
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
    awsConfig: ApplicationDomain["awsConfig"],
    ecsConfig: ApplicationDomain["ecsConfig"]
  ): Promise<ServiceDomain | undefined> {
    const client = await this.createEcsClient(awsConfig);
    const command = new DescribeServicesCommand({
      cluster: ecsConfig.cluster,
      services: [ecsConfig.service],
    });
    const response = await client.send(command);
    if (response.failures && response.failures.length > 0) {
      return undefined;
    }
    const service: ServiceDomain = {
      status: toEcsServiceStatus(response.services?.[0]?.status),
      desiredCount: response.services?.[0]?.desiredCount || 0,
      runningCount: response.services?.[0]?.runningCount || 0,
      taskDefinition: response.services?.[0]?.taskDefinition || "",
      deployments: (response.services?.[0]?.deployments || []).map((d) => ({
        status: toEcsDeploymentStatus(d.status),
        rolloutState: toEcsRolloutState(d.rolloutState),
        rolloutStateReason: normalizeRolloutStateReason(
          d.rolloutState,
          d.rolloutStateReason
        ),
        createdAt: d.createdAt || new Date(),
        updatedAt: d.updatedAt || new Date(),
      })),
    };
    return service;
  }

  async describeTaskDefinition(
    awsConfig: ApplicationDomain["awsConfig"],
    taskDefinitionArn: string
  ): Promise<TaskDefinitionSpec | undefined> {
    const client = await this.createEcsClient(awsConfig);
    const command = new DescribeTaskDefinitionCommand({
      taskDefinition: taskDefinitionArn,
    });
    const response = await client.send(command);
    if (!response.taskDefinition) {
      return undefined;
    }
    return toTaskDefinitionSpec(
      response.taskDefinition as unknown as Record<string, unknown>,
    );
  }

  async registerTaskDefinition(
    awsConfig: ApplicationDomain["awsConfig"],
    taskDef: TaskDefinitionSpec
  ): Promise<string> {
    const client = await this.createEcsClient(awsConfig);
    const taskDefInput = toRegisterTaskDefinitionInput(taskDef);
    // Remove tags if empty to avoid "Tags can not be empty" error
    const cleanedInput: RegisterTaskDefinitionCommandInput = { ...taskDefInput };
    if (cleanedInput.tags && cleanedInput.tags.length === 0) {
      delete cleanedInput.tags;
    }

    // AWS API は空配列を渡すと拒否するので、シリアライズ時だけ空配列を取り除く。
    // ユーザーが宣言した desired state の意味を変える変更 (例: 無効要素の黙示 filter) は
    // ここで行わない。
    if (cleanedInput.containerDefinitions) {
      cleanedInput.containerDefinitions = cleanedInput.containerDefinitions.map(
        (container) => {
          const cleanedContainer = { ...container };

          if (
            cleanedContainer.secrets &&
            cleanedContainer.secrets.length === 0
          ) {
            delete cleanedContainer.secrets;
          }

          if (
            cleanedContainer.environment &&
            cleanedContainer.environment.length === 0
          ) {
            delete cleanedContainer.environment;
          }

          if (
            cleanedContainer.mountPoints &&
            cleanedContainer.mountPoints.length === 0
          ) {
            delete cleanedContainer.mountPoints;
          }

          if (
            cleanedContainer.volumesFrom &&
            cleanedContainer.volumesFrom.length === 0
          ) {
            delete cleanedContainer.volumesFrom;
          }

          return cleanedContainer;
        }
      );
    }

    const response = await client.send(
      new RegisterTaskDefinitionCommand(cleanedInput)
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
    awsConfig: ApplicationDomain["awsConfig"],
    ecsConfig: ApplicationDomain["ecsConfig"],
    taskDefinitionArn: string
  ): Promise<void> {
    const client = await this.createEcsClient(awsConfig);
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

  async stopServiceDeployment(
    awsConfig: ApplicationDomain["awsConfig"],
    ecsConfig: ApplicationDomain["ecsConfig"]
  ): Promise<void> {
    const client = await this.createEcsClient(awsConfig);
    const listCommand = new ListServiceDeploymentsCommand({
      cluster: ecsConfig.cluster,
      service: ecsConfig.service,
    });
    const listResponse = await client.send(listCommand);
    const deployment = listResponse.serviceDeployments?.find(
      (d) => d.status === "IN_PROGRESS"
    );
    if (!deployment) {
      throw new Error(
        `No in-progress deployment found for service ${ecsConfig.service}`
      );
    }
    const command = new StopServiceDeploymentCommand({
      serviceDeploymentArn: deployment.serviceDeploymentArn,
      stopType: "ROLLBACK",
    });
    const response = await client.send(command);
    if (!response.serviceDeploymentArn) {
      throw new Error("Failed to stop service deployment");
    }
    return;
  }
}
