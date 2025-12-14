import { IAws } from "./interface/aws";
import { IGithub } from "./interface/github";
import { ApplicationDomain, DiffDomain } from "../domain/application";
import { DeploymentRepository } from "../repository/deployment";
import { RegisterTaskDefinitionCommandInput } from "@aws-sdk/client-ecs";

export class Deployment implements DeploymentRepository {
  constructor(private aws: IAws, private github: IGithub) {}
  async syncService(application: ApplicationDomain): Promise<void> {
    const taskDefinition = await this.github.getFileContent(application);
    if (!taskDefinition) {
      throw new Error("Task definition file not found");
    }
    const client = await this.aws.createECSClient(application.awsConfig);
    const taskDefinitionArn = await this.aws.registerTaskDefinition(
      client,
      taskDefinition
    );
    await this.aws.updateService(
      client,
      application.ecsConfig,
      taskDefinitionArn
    );
  }

  async rollback(application: ApplicationDomain): Promise<void> {
    const client = await this.aws.createECSClient(application.awsConfig);
    await this.aws.stopServiceDeployment(client, application.ecsConfig);
  }

  async diff(application: ApplicationDomain): Promise<DiffDomain[]> {
    const taskDefinition = await this.github.getFileContent(application);
    if (!taskDefinition) {
      throw new Error("Task definition file not found");
    }
    const client = await this.aws.createECSClient(application.awsConfig);
    const currentService = await this.aws.describeServices(
      client,
      application.ecsConfig
    );
    if (!currentService) {
      throw new Error("ECS Service not found");
    }
    const currentTaskDefArn = currentService.taskDefinition;
    if (!currentTaskDefArn) {
      throw new Error("Current task definition ARN not found");
    }
    const currentTaskDef = await this.aws.describeTaskDefinition(
      client,
      currentTaskDefArn
    );
    if (!currentTaskDef) {
      throw new Error("Current task definition not found");
    }
    // Compare the two task definitions and generate diffs
    const diffs = await this.compareTaskDefinition(
      currentTaskDef,
      taskDefinition
    );
    return diffs;
  }

  /**
   * Recursively flatten an object/array into a Map with dot-notation paths
   * @param obj - Object to flatten
   * @param prefix - Current path prefix
   * @returns Map with flattened key-value pairs
   */
  private flattenToMap(obj: any, prefix: string = ""): Map<string, string> {
    const result = new Map<string, string>();

    // undefined = don't add to map
    if (obj === undefined) {
      return result;
    }

    // null = add as "null" string
    if (obj === null) {
      result.set(prefix, "null");
      return result;
    }

    // Handle objects
    if (typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        for (const [k, v] of this.flattenToMap(value, newPrefix)) {
          result.set(k, v);
        }
      }
      return result;
    }

    // Primitive value: convert to string
    result.set(prefix, String(obj));
    return result;
  }

  /**
   * Compare two flattened Maps and generate diff objects
   * @param currentMap - Map representation of current task definition
   * @param targetMap - Map representation of target task definition
   * @returns Array of diff objects
   */
  private compareMaps(
    currentMap: Map<string, string>,
    targetMap: Map<string, string>
  ): DiffDomain[] {
    const diffs: DiffDomain[] = [];

    // Find removed (in current but not in target)
    for (const [path, currentValue] of currentMap) {
      if (!targetMap.has(path)) {
        diffs.push({
          path,
          current: currentValue,
          target: undefined,
          type: "Removed",
        });
      }
    }

    // Find added and modified (in target)
    for (const [path, targetValue] of targetMap) {
      if (!currentMap.has(path)) {
        diffs.push({
          path,
          current: undefined,
          target: targetValue,
          type: "Added",
        });
      } else if (currentMap.get(path) !== targetValue) {
        diffs.push({
          path,
          current: currentMap.get(path),
          target: targetValue,
          type: "Modified",
        });
      }
    }

    return diffs;
  }

  /**
   * Clean task definition by removing AWS-generated fields that shouldn't be compared
   * @param taskDef - Task definition to clean
   * @returns Cleaned task definition
   */
  private cleanTaskDefinitionForComparison(
    taskDef: RegisterTaskDefinitionCommandInput
  ): RegisterTaskDefinitionCommandInput {
    // Create a copy and remove AWS-generated fields
    const {
      revision,
      taskDefinitionArn,
      registeredAt,
      registeredBy,
      status,
      requiresAttributes,
      compatibilities,
      ...cleanedTaskDef
    } = taskDef as any;

    return cleanedTaskDef;
  }

  private async compareTaskDefinition(
    current: RegisterTaskDefinitionCommandInput,
    target: RegisterTaskDefinitionCommandInput
  ): Promise<DiffDomain[]> {
    // Clean both task definitions by removing AWS-generated fields
    const cleanedCurrent = this.cleanTaskDefinitionForComparison(current);
    const cleanedTarget = this.cleanTaskDefinitionForComparison(target);

    // Convert both to flat maps
    const currentMap = this.flattenToMap(cleanedCurrent);
    const targetMap = this.flattenToMap(cleanedTarget);

    // Compare maps and return diffs
    return this.compareMaps(currentMap, targetMap);
  }
}
