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

    // Handle arrays with special naming for environment, secrets, and containerDefinitions
    if (Array.isArray(obj)) {
      // Empty arrays should not add any entries
      if (obj.length === 0) {
        return result;
      }

      const isStringArray = obj.every((item) => typeof item === "string");

      if (isStringArray) {
        // For string arrays like command and entryPoint, join values with commas
        const joinedValue = obj.join(",");
        result.set(prefix, joinedValue);
        return result;
      }

      // Check if this is a containerDefinitions array
      const isContainerDefinitions = prefix.endsWith("containerDefinitions");

      // Check if this is an environment or secrets array
      const isEnvironmentOrSecrets =
        prefix.endsWith("environment") || prefix.endsWith("secrets");

      // Check if this is a volumes array (has 'name' property)
      const isVolumes = prefix.endsWith("volumes");

      // Check if this is a placementConstraints array (has 'type' property)
      const isPlacementConstraints = prefix.endsWith("placementConstraints");

      // Check if this is a mountPoints array (has 'sourceVolume' property)
      const isMountPoints = prefix.endsWith("mountPoints");

      // Check if this is a volumesFrom array (has 'sourceContainer' property)
      const isVolumesFrom = prefix.endsWith("volumesFrom");

      // Check if this is a portMappings array (has 'containerPort' property)
      const isPortMappings = prefix.endsWith("portMappings");

      // Check if this is a ulimits array (has 'name' property)
      const isUlimits = prefix.endsWith("ulimits");

      // Check if this is a systemControls array (has 'namespace' property)
      const isSystemControls = prefix.endsWith("systemControls");

      // Check if this is a resourceRequirements array (has 'type' property)
      const isResourceRequirements = prefix.endsWith("resourceRequirements");

      // Check if this is a dependsOn array (has 'containerName' property)
      const isDependsOn = prefix.endsWith("dependsOn");

      // Check if this is a tags array (has 'key' property for identification)
      const isTags = prefix.endsWith("tags");

      if (isTags) {
        // For tags array, use 'key' as path and 'value' as the value
        for (const item of obj) {
          if (typeof item === "object" && item !== null && "key" in item) {
            const tagKey = item.key;
            const tagValue = item.value || "";
            const path = prefix ? `${prefix}.${tagKey}` : tagKey;
            result.set(path, String(tagValue));
          }
        }
      } else if (isEnvironmentOrSecrets) {
        // For environment and secrets arrays, use 'name' as key
        for (const item of obj) {
          if (typeof item === "object" && item !== null && "name" in item) {
            const itemName = item.name;
            const itemValue = item.value || item.valueFrom || "";
            const key = prefix ? `${prefix}.${itemName}` : itemName;
            result.set(key, String(itemValue));
          }
        }
      } else if (isContainerDefinitions || isVolumes || isUlimits) {
        // For arrays with 'name' property, use 'name' as key
        for (const item of obj) {
          if (typeof item === "object" && item !== null && "name" in item) {
            const itemName = item.name;
            const newPrefix = prefix ? `${prefix}.${itemName}` : itemName;
            for (const [k, v] of this.flattenToMap(item, newPrefix)) {
              result.set(k, v);
            }
          }
        }
      } else if (isPlacementConstraints || isResourceRequirements) {
        // For arrays with 'type' property, use 'type' as key
        for (const item of obj) {
          if (typeof item === "object" && item !== null && "type" in item) {
            const itemType = item.type;
            const newPrefix = prefix ? `${prefix}.${itemType}` : itemType;
            for (const [k, v] of this.flattenToMap(item, newPrefix)) {
              result.set(k, v);
            }
          }
        }
      } else if (isMountPoints) {
        // For mountPoints, use 'sourceVolume' as key
        for (const item of obj) {
          if (
            typeof item === "object" &&
            item !== null &&
            "sourceVolume" in item
          ) {
            const sourceVolume = item.sourceVolume;
            const newPrefix = prefix
              ? `${prefix}.${sourceVolume}`
              : sourceVolume;
            for (const [k, v] of this.flattenToMap(item, newPrefix)) {
              result.set(k, v);
            }
          }
        }
      } else if (isVolumesFrom) {
        // For volumesFrom, use 'sourceContainer' as key
        for (const item of obj) {
          if (
            typeof item === "object" &&
            item !== null &&
            "sourceContainer" in item
          ) {
            const sourceContainer = item.sourceContainer;
            const newPrefix = prefix
              ? `${prefix}.${sourceContainer}`
              : sourceContainer;
            for (const [k, v] of this.flattenToMap(item, newPrefix)) {
              result.set(k, v);
            }
          }
        }
      } else if (isPortMappings) {
        // For portMappings, use 'containerPort' as key
        for (const item of obj) {
          if (
            typeof item === "object" &&
            item !== null &&
            "containerPort" in item
          ) {
            const containerPort = item.containerPort;
            const newPrefix = prefix
              ? `${prefix}.${containerPort}`
              : String(containerPort);
            for (const [k, v] of this.flattenToMap(item, newPrefix)) {
              result.set(k, v);
            }
          }
        }
      } else if (isSystemControls) {
        // For systemControls, use 'namespace' as key
        for (const item of obj) {
          if (
            typeof item === "object" &&
            item !== null &&
            "namespace" in item
          ) {
            const namespace = item.namespace;
            const newPrefix = prefix ? `${prefix}.${namespace}` : namespace;
            for (const [k, v] of this.flattenToMap(item, newPrefix)) {
              result.set(k, v);
            }
          }
        }
      } else if (isDependsOn) {
        // For dependsOn, use 'containerName' as key
        for (const item of obj) {
          if (
            typeof item === "object" &&
            item !== null &&
            "containerName" in item
          ) {
            const containerName = item.containerName;
            const newPrefix = prefix
              ? `${prefix}.${containerName}`
              : containerName;
            for (const [k, v] of this.flattenToMap(item, newPrefix)) {
              result.set(k, v);
            }
          }
        }
      } else {
        // For other arrays, use index as key
        for (let i = 0; i < obj.length; i++) {
          const newPrefix = prefix ? `${prefix}.${i}` : String(i);
          for (const [k, v] of this.flattenToMap(obj[i], newPrefix)) {
            result.set(k, v);
          }
        }
      }
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
