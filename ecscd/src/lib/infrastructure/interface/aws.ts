import { ApplicationDomain, ServiceDomain } from "../../domain/application";
import { TaskDefinitionSpec } from "../../domain/task-definition";

export interface IAws {
  registerTaskDefinition(
    awsConfig: ApplicationDomain["awsConfig"],
    taskDef: TaskDefinitionSpec
  ): Promise<string>;
  updateService(
    awsConfig: ApplicationDomain["awsConfig"],
    ecsConfig: ApplicationDomain["ecsConfig"],
    taskDefinitionArn: string
  ): Promise<void>;
  describeServices(
    awsConfig: ApplicationDomain["awsConfig"],
    ecsConfig: ApplicationDomain["ecsConfig"]
  ): Promise<ServiceDomain | undefined>;
  describeTaskDefinition(
    awsConfig: ApplicationDomain["awsConfig"],
    taskDefinitionArn: string
  ): Promise<TaskDefinitionSpec | undefined>;
  stopServiceDeployment(
    awsConfig: ApplicationDomain["awsConfig"],
    ecsConfig: ApplicationDomain["ecsConfig"]
  ): Promise<void>;
}
