import { ApplicationDomain } from "../../domain/application";
import { RegisterTaskDefinitionCommandInput } from "@aws-sdk/client-ecs/dist-types/commands";
import { ECSClient } from "@aws-sdk/client-ecs";

export interface IAws {
  createECSClient(
    awsConfig: ApplicationDomain["awsConfig"]
  ): Promise<ECSClient>;
  registerTaskDefinition(
    client: ECSClient,
    taskDef: RegisterTaskDefinitionCommandInput
  ): Promise<string>;
  updateService(
    client: ECSClient,
    ecsConfig: ApplicationDomain["ecsConfig"],
    taskDefinitionArn: string
  ): Promise<void>;
  describeServices(
    client: ECSClient,
    ecsConfig: ApplicationDomain["ecsConfig"]
  ): Promise<ApplicationDomain["service"]>;
  describeTaskDefinition(
    client: ECSClient,
    taskDefinitionArn: string
  ): Promise<RegisterTaskDefinitionCommandInput | undefined>;
  stopServiceDeployment(
    client: ECSClient,
    ecsConfig: ApplicationDomain["ecsConfig"]
  ): Promise<void>;
}
