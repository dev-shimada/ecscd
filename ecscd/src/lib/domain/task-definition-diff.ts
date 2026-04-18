import { DiffDomain } from "./application";
import { TaskDefinitionSpec } from "./task-definition";

/**
 * Recursively flatten an object/array into a Map with dot-notation paths.
 */
function flattenToMap(obj: unknown, prefix: string = ""): Map<string, string> {
  const result = new Map<string, string>();

  if (obj === undefined) {
    return result;
  }

  if (obj === null) {
    result.set(prefix, "null");
    return result;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return result;
    }

    const isStringArray = obj.every((item) => typeof item === "string");

    if (isStringArray) {
      result.set(prefix, obj.join(","));
      return result;
    }

    const isContainerDefinitions = prefix.endsWith("containerDefinitions");
    const isEnvironmentOrSecrets =
      prefix.endsWith("environment") || prefix.endsWith("secrets");
    const isVolumes = prefix.endsWith("volumes");
    const isPlacementConstraints = prefix.endsWith("placementConstraints");
    const isMountPoints = prefix.endsWith("mountPoints");
    const isVolumesFrom = prefix.endsWith("volumesFrom");
    const isPortMappings = prefix.endsWith("portMappings");
    const isUlimits = prefix.endsWith("ulimits");
    const isSystemControls = prefix.endsWith("systemControls");
    const isResourceRequirements = prefix.endsWith("resourceRequirements");
    const isDependsOn = prefix.endsWith("dependsOn");
    const isTags = prefix.endsWith("tags");

    if (isTags) {
      for (const item of obj) {
        if (isObjectWithKey(item, "key")) {
          const tagKey = item.key;
          const tagValue = "value" in item ? item.value : "";
          const path = prefix ? `${prefix}.${String(tagKey)}` : String(tagKey);
          result.set(path, String(tagValue || ""));
        }
      }
    } else if (isEnvironmentOrSecrets) {
      for (const item of obj) {
        if (isObjectWithKey(item, "name")) {
          const itemName = item.name;
          const itemValue = getEnvironmentLikeValue(item);
          const key = prefix
            ? `${prefix}.${String(itemName)}`
            : String(itemName);
          result.set(key, String(itemValue || ""));
        }
      }
    } else if (isContainerDefinitions || isVolumes || isUlimits) {
      for (const item of obj) {
        if (isObjectWithKey(item, "name")) {
          const itemName = item.name;
          const newPrefix = prefix
            ? `${prefix}.${String(itemName)}`
            : String(itemName);
          for (const [k, v] of flattenToMap(item, newPrefix)) {
            result.set(k, v);
          }
        }
      }
    } else if (isPlacementConstraints || isResourceRequirements) {
      for (const item of obj) {
        if (isObjectWithKey(item, "type")) {
          const itemType = item.type;
          const newPrefix = prefix
            ? `${prefix}.${String(itemType)}`
            : String(itemType);
          for (const [k, v] of flattenToMap(item, newPrefix)) {
            result.set(k, v);
          }
        }
      }
    } else if (isMountPoints) {
      for (const item of obj) {
        if (isObjectWithKey(item, "sourceVolume")) {
          const sourceVolume = item.sourceVolume;
          const newPrefix = prefix
            ? `${prefix}.${String(sourceVolume)}`
            : String(sourceVolume);
          for (const [k, v] of flattenToMap(item, newPrefix)) {
            result.set(k, v);
          }
        }
      }
    } else if (isVolumesFrom) {
      for (const item of obj) {
        if (isObjectWithKey(item, "sourceContainer")) {
          const sourceContainer = item.sourceContainer;
          const newPrefix = prefix
            ? `${prefix}.${String(sourceContainer)}`
            : String(sourceContainer);
          for (const [k, v] of flattenToMap(item, newPrefix)) {
            result.set(k, v);
          }
        }
      }
    } else if (isPortMappings) {
      for (const item of obj) {
        if (isObjectWithKey(item, "containerPort")) {
          const containerPort = item.containerPort;
          const newPrefix = prefix
            ? `${prefix}.${String(containerPort)}`
            : String(containerPort);
          for (const [k, v] of flattenToMap(item, newPrefix)) {
            result.set(k, v);
          }
        }
      }
    } else if (isSystemControls) {
      for (const item of obj) {
        if (isObjectWithKey(item, "namespace")) {
          const namespace = item.namespace;
          const newPrefix = prefix
            ? `${prefix}.${String(namespace)}`
            : String(namespace);
          for (const [k, v] of flattenToMap(item, newPrefix)) {
            result.set(k, v);
          }
        }
      }
    } else if (isDependsOn) {
      for (const item of obj) {
        if (isObjectWithKey(item, "containerName")) {
          const containerName = item.containerName;
          const newPrefix = prefix
            ? `${prefix}.${String(containerName)}`
            : String(containerName);
          for (const [k, v] of flattenToMap(item, newPrefix)) {
            result.set(k, v);
          }
        }
      }
    } else {
      for (let i = 0; i < obj.length; i++) {
        const newPrefix = prefix ? `${prefix}.${i}` : String(i);
        for (const [k, v] of flattenToMap(obj[i], newPrefix)) {
          result.set(k, v);
        }
      }
    }

    return result;
  }

  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      for (const [k, v] of flattenToMap(value, newPrefix)) {
        result.set(k, v);
      }
    }

    return result;
  }

  result.set(prefix, String(obj));
  return result;
}

function isObjectWithKey<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, unknown> {
  return typeof value === "object" && value !== null && key in value;
}

function getEnvironmentLikeValue(item: Record<string, unknown>): unknown {
  if ("value" in item) {
    return item.value;
  }

  if ("valueFrom" in item) {
    return item.valueFrom;
  }

  return "";
}

function compareMaps(
  currentMap: Map<string, string>,
  targetMap: Map<string, string>,
): DiffDomain[] {
  const diffs: DiffDomain[] = [];

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

export function compareTaskDefinitions(
  current: TaskDefinitionSpec,
  target: TaskDefinitionSpec,
): DiffDomain[] {
  return compareMaps(flattenToMap(current), flattenToMap(target));
}
