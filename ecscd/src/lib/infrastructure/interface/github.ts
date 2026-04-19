import { GitTaskDefinitionSource } from "../../domain/application";
import { TaskDefinitionSpec } from "../../domain/task-definition";

export type GitTaskDefinitionError =
  | { type: "InvalidRepositoryUrl"; url: string }
  | { type: "CommitNotFound"; branch: string }
  | { type: "FileNotFound"; path: string }
  | { type: "InvalidTaskDefinition"; reason: string }
  | { type: "FetchFailed"; reason: string };

export type GitTaskDefinitionResult =
  | { status: "Success"; taskDefinition: TaskDefinitionSpec }
  | { status: "Error"; error: GitTaskDefinitionError };

export interface IGithub {
  getTaskDefinition(
    source: GitTaskDefinitionSource
  ): Promise<GitTaskDefinitionResult>;
}
