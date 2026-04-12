import { RegisterTaskDefinitionCommandInput } from "@aws-sdk/client-ecs";

import { ApplicationDomain, ServiceDomain } from "../domain/application";

export interface TaskDefinitionsForDiff {
  current: RegisterTaskDefinitionCommandInput;
  target: RegisterTaskDefinitionCommandInput;
}

export interface DeploymentRepository {
  syncService(application: ApplicationDomain): Promise<void>;
  rollback(application: ApplicationDomain): Promise<void>;
  getTaskDefinitionsForDiff(
    application: ApplicationDomain,
    service?: ServiceDomain,
  ): Promise<TaskDefinitionsForDiff>;
}
