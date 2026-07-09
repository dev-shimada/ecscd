import { ApplicationDomain, ServiceDomain } from "../domain/application";
import { TaskDefinitionSpec } from "../domain/task-definition";

export interface TaskDefinitionsForDiff {
  current: TaskDefinitionSpec;
  target: TaskDefinitionSpec;
}

export interface DeploymentRepository {
  syncService(application: ApplicationDomain): Promise<void>;
  rollback(application: ApplicationDomain): Promise<void>;
  getTaskDefinitionsForDiff(
    application: ApplicationDomain,
    service?: ServiceDomain,
  ): Promise<TaskDefinitionsForDiff>;
}
