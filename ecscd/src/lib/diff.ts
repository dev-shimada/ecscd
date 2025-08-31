import { ECSTaskDefinition, TaskDefinitionDiff } from '@/types/ecs';

export class DiffService {
  static compareTaskDefinitions(
    current: ECSTaskDefinition | null,
    target: ECSTaskDefinition | null
  ): TaskDefinitionDiff[] {
    const diffs: TaskDefinitionDiff[] = [];

    if (!current && !target) {
      return diffs;
    }

    if (!current && target) {
      diffs.push({
        path: 'taskDefinition',
        type: 'added',
        targetValue: target,
        message: 'New task definition will be created'
      });
      return diffs;
    }

    if (current && !target) {
      diffs.push({
        path: 'taskDefinition',
        type: 'removed',
        currentValue: current,
        message: 'Task definition will be removed'
      });
      return diffs;
    }

    if (!current || !target) {
      return diffs;
    }

    // Compare basic properties
    this.compareProperty(diffs, 'family', current.family, target.family);
    this.compareProperty(diffs, 'cpu', current.cpu, target.cpu);
    this.compareProperty(diffs, 'memory', current.memory, target.memory);
    this.compareProperty(diffs, 'networkMode', current.networkMode, target.networkMode);
    this.compareProperty(diffs, 'executionRoleArn', current.executionRoleArn, target.executionRoleArn);
    this.compareProperty(diffs, 'taskRoleArn', current.taskRoleArn, target.taskRoleArn);

    // Compare container definitions
    this.compareContainerDefinitions(diffs, current.containerDefinitions, target.containerDefinitions);

    // Compare volumes
    this.compareVolumes(diffs, current.volumes || [], target.volumes || []);

    return diffs;
  }

  private static compareProperty(
    diffs: TaskDefinitionDiff[],
    path: string,
    currentValue: any,
    targetValue: any
  ): void {
    if (JSON.stringify(currentValue) !== JSON.stringify(targetValue)) {
      let type: 'added' | 'removed' | 'modified' = 'modified';
      
      if (currentValue === undefined && targetValue !== undefined) {
        type = 'added';
      } else if (currentValue !== undefined && targetValue === undefined) {
        type = 'removed';
      }

      diffs.push({
        path,
        type,
        currentValue,
        targetValue,
        message: `${path} will be ${type === 'added' ? 'added' : type === 'removed' ? 'removed' : 'modified'}`
      });
    }
  }

  private static compareContainerDefinitions(
    diffs: TaskDefinitionDiff[],
    current: any[],
    target: any[]
  ): void {
    const currentMap = new Map(current.map(c => [c.name, c]));
    const targetMap = new Map(target.map(c => [c.name, c]));

    // Check for removed containers
    for (const [name, container] of currentMap) {
      if (!targetMap.has(name)) {
        diffs.push({
          path: `containerDefinitions.${name}`,
          type: 'removed',
          currentValue: container,
          message: `Container "${name}" will be removed`
        });
      }
    }

    // Check for added and modified containers
    for (const [name, targetContainer] of targetMap) {
      if (!currentMap.has(name)) {
        diffs.push({
          path: `containerDefinitions.${name}`,
          type: 'added',
          targetValue: targetContainer,
          message: `Container "${name}" will be added`
        });
      } else {
        const currentContainer = currentMap.get(name);
        this.compareContainerDefinition(diffs, name, currentContainer, targetContainer);
      }
    }
  }

  private static compareContainerDefinition(
    diffs: TaskDefinitionDiff[],
    containerName: string,
    current: any,
    target: any
  ): void {
    const properties = [
      'image', 'cpu', 'memory', 'memoryReservation', 'essential',
      'entryPoint', 'command', 'workingDirectory', 'user'
    ];

    for (const prop of properties) {
      if (JSON.stringify(current[prop]) !== JSON.stringify(target[prop])) {
        diffs.push({
          path: `containerDefinitions.${containerName}.${prop}`,
          type: 'modified',
          currentValue: current[prop],
          targetValue: target[prop],
          message: `Container "${containerName}" ${prop} will be modified`
        });
      }
    }

    // Compare environment variables
    this.compareEnvironmentVariables(diffs, containerName, current.environment || [], target.environment || []);

    // Compare port mappings
    this.comparePortMappings(diffs, containerName, current.portMappings || [], target.portMappings || []);

    // Compare secrets
    this.compareSecrets(diffs, containerName, current.secrets || [], target.secrets || []);
  }

  private static compareEnvironmentVariables(
    diffs: TaskDefinitionDiff[],
    containerName: string,
    current: Array<{ name: string; value: string }>,
    target: Array<{ name: string; value: string }>
  ): void {
    const currentMap = new Map(current.map(env => [env.name, env.value]));
    const targetMap = new Map(target.map(env => [env.name, env.value]));

    // Check for removed environment variables
    for (const [name, value] of currentMap) {
      if (!targetMap.has(name)) {
        diffs.push({
          path: `containerDefinitions.${containerName}.environment.${name}`,
          type: 'removed',
          currentValue: value,
          message: `Environment variable "${name}" will be removed from container "${containerName}"`
        });
      }
    }

    // Check for added and modified environment variables
    for (const [name, targetValue] of targetMap) {
      if (!currentMap.has(name)) {
        diffs.push({
          path: `containerDefinitions.${containerName}.environment.${name}`,
          type: 'added',
          targetValue: targetValue,
          message: `Environment variable "${name}" will be added to container "${containerName}"`
        });
      } else {
        const currentValue = currentMap.get(name);
        if (currentValue !== targetValue) {
          diffs.push({
            path: `containerDefinitions.${containerName}.environment.${name}`,
            type: 'modified',
            currentValue: currentValue,
            targetValue: targetValue,
            message: `Environment variable "${name}" will be modified in container "${containerName}"`
          });
        }
      }
    }
  }

  private static comparePortMappings(
    diffs: TaskDefinitionDiff[],
    containerName: string,
    current: Array<{ containerPort: number; hostPort?: number; protocol?: string }>,
    target: Array<{ containerPort: number; hostPort?: number; protocol?: string }>
  ): void {
    if (JSON.stringify(current) !== JSON.stringify(target)) {
      diffs.push({
        path: `containerDefinitions.${containerName}.portMappings`,
        type: 'modified',
        currentValue: current,
        targetValue: target,
        message: `Port mappings will be modified for container "${containerName}"`
      });
    }
  }

  private static compareSecrets(
    diffs: TaskDefinitionDiff[],
    containerName: string,
    current: Array<{ name: string; valueFrom: string }>,
    target: Array<{ name: string; valueFrom: string }>
  ): void {
    const currentMap = new Map(current.map(secret => [secret.name, secret.valueFrom]));
    const targetMap = new Map(target.map(secret => [secret.name, secret.valueFrom]));

    // Check for removed secrets
    for (const [name, valueFrom] of currentMap) {
      if (!targetMap.has(name)) {
        diffs.push({
          path: `containerDefinitions.${containerName}.secrets.${name}`,
          type: 'removed',
          currentValue: valueFrom,
          message: `Secret "${name}" will be removed from container "${containerName}"`
        });
      }
    }

    // Check for added and modified secrets
    for (const [name, targetValueFrom] of targetMap) {
      if (!currentMap.has(name)) {
        diffs.push({
          path: `containerDefinitions.${containerName}.secrets.${name}`,
          type: 'added',
          targetValue: targetValueFrom,
          message: `Secret "${name}" will be added to container "${containerName}"`
        });
      } else {
        const currentValueFrom = currentMap.get(name);
        if (currentValueFrom !== targetValueFrom) {
          diffs.push({
            path: `containerDefinitions.${containerName}.secrets.${name}`,
            type: 'modified',
            currentValue: currentValueFrom,
            targetValue: targetValueFrom,
            message: `Secret "${name}" will be modified in container "${containerName}"`
          });
        }
      }
    }
  }

  private static compareVolumes(
    diffs: TaskDefinitionDiff[],
    current: any[],
    target: any[]
  ): void {
    if (JSON.stringify(current) !== JSON.stringify(target)) {
      diffs.push({
        path: 'volumes',
        type: 'modified',
        currentValue: current,
        targetValue: target,
        message: 'Volume configuration will be modified'
      });
    }
  }

  static generateDiffSummary(diffs: TaskDefinitionDiff[]): string {
    if (diffs.length === 0) {
      return 'No changes detected';
    }

    const summary = {
      added: diffs.filter(d => d.type === 'added').length,
      modified: diffs.filter(d => d.type === 'modified').length,
      removed: diffs.filter(d => d.type === 'removed').length
    };

    const parts = [];
    if (summary.added > 0) parts.push(`${summary.added} added`);
    if (summary.modified > 0) parts.push(`${summary.modified} modified`);
    if (summary.removed > 0) parts.push(`${summary.removed} removed`);

    return `${diffs.length} changes: ${parts.join(', ')}`;
  }
}