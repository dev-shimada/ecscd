import { ApplicationDomain } from "../../domain/application";
import { TaskDefinitionSpec } from "../../domain/task-definition";

export interface IGithub {
  getFileContent(
    application: ApplicationDomain
  ): Promise<TaskDefinitionSpec | null>;
}
