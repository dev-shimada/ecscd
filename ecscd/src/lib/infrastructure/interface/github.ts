import { RegisterTaskDefinitionCommandInput } from "@aws-sdk/client-ecs";
import { ApplicationDomain } from "../../domain/application";

export interface IGithub {
  getFileContent(
    application: ApplicationDomain
  ): Promise<RegisterTaskDefinitionCommandInput | null>;
}
