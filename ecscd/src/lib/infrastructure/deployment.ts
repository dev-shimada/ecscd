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
  private async compareTaskDefinition(
    current: RegisterTaskDefinitionCommandInput,
    target: RegisterTaskDefinitionCommandInput
  ): Promise<DiffDomain[]> {
    const diffs: DiffDomain[] = [];

    // Compare family
    if (current.family !== target.family) {
      diffs.push({
        path: "family",
        current: current.family,
        target: target.family,
        type: "Modified"
      });
    }

    // Compare CPU
    if (current.cpu !== target.cpu) {
      diffs.push({
        path: "cpu",
        current: current.cpu,
        target: target.cpu,
        type: "Modified"
      });
    }

    // Compare memory
    if (current.memory !== target.memory) {
      diffs.push({
        path: "memory",
        current: current.memory,
        target: target.memory,
        type: "Modified"
      });
    }

    // Compare network mode
    if (current.networkMode !== target.networkMode) {
      diffs.push({
        path: "networkMode",
        current: current.networkMode,
        target: target.networkMode,
        type: "Modified"
      });
    }

    // Compare execution role ARN
    if (current.executionRoleArn !== target.executionRoleArn) {
      diffs.push({
        path: "executionRoleArn",
        current: current.executionRoleArn,
        target: target.executionRoleArn,
        type: "Modified"
      });
    }

    // Compare task role ARN
    if (current.taskRoleArn !== target.taskRoleArn) {
      diffs.push({
        path: "taskRoleArn",
        current: current.taskRoleArn,
        target: target.taskRoleArn,
        type: "Modified"
      });
    }

    // Compare container definitions
    const currentContainers = current.containerDefinitions || [];
    const targetContainers = target.containerDefinitions || [];

    // Find containers that exist in current but not in target (removed)
    for (const currentContainer of currentContainers) {
      const targetContainer = targetContainers.find(c => c.name === currentContainer.name);
      if (!targetContainer) {
        diffs.push({
          path: `containerDefinitions[${currentContainer.name}]`,
          current: JSON.stringify(currentContainer),
          target: undefined,
          type: "Removed"
        });
      }
    }

    // Find containers that exist in target but not in current (added)
    for (const targetContainer of targetContainers) {
      const currentContainer = currentContainers.find(c => c.name === targetContainer.name);
      if (!currentContainer) {
        diffs.push({
          path: `containerDefinitions[${targetContainer.name}]`,
          current: undefined,
          target: JSON.stringify(targetContainer),
          type: "Added"
        });
      }
    }

    // Compare existing containers
    for (const currentContainer of currentContainers) {
      const targetContainer = targetContainers.find(c => c.name === currentContainer.name);
      if (targetContainer) {
        // Compare image
        if (currentContainer.image !== targetContainer.image) {
          diffs.push({
            path: `containerDefinitions[${currentContainer.name}].image`,
            current: currentContainer.image,
            target: targetContainer.image,
            type: "Modified"
          });
        }

        // Compare CPU
        if (currentContainer.cpu !== targetContainer.cpu) {
          diffs.push({
            path: `containerDefinitions[${currentContainer.name}].cpu`,
            current: currentContainer.cpu?.toString(),
            target: targetContainer.cpu?.toString(),
            type: "Modified"
          });
        }

        // Compare memory
        if (currentContainer.memory !== targetContainer.memory) {
          diffs.push({
            path: `containerDefinitions[${currentContainer.name}].memory`,
            current: currentContainer.memory?.toString(),
            target: targetContainer.memory?.toString(),
            type: "Modified"
          });
        }

        // Compare memory reservation
        if (currentContainer.memoryReservation !== targetContainer.memoryReservation) {
          diffs.push({
            path: `containerDefinitions[${currentContainer.name}].memoryReservation`,
            current: currentContainer.memoryReservation?.toString(),
            target: targetContainer.memoryReservation?.toString(),
            type: "Modified"
          });
        }

        // Compare essential
        if (currentContainer.essential !== targetContainer.essential) {
          diffs.push({
            path: `containerDefinitions[${currentContainer.name}].essential`,
            current: currentContainer.essential?.toString(),
            target: targetContainer.essential?.toString(),
            type: "Modified"
          });
        }

        // Compare environment variables
        const currentEnv = currentContainer.environment || [];
        const targetEnv = targetContainer.environment || [];
        
        const currentEnvMap = new Map(currentEnv.map(e => [e.name, e.value]));
        const targetEnvMap = new Map(targetEnv.map(e => [e.name, e.value]));

        // Find removed environment variables
        for (const [name, value] of currentEnvMap) {
          if (!targetEnvMap.has(name)) {
            diffs.push({
              path: `containerDefinitions[${currentContainer.name}].environment[${name}]`,
              current: value,
              target: undefined,
              type: "Removed"
            });
          }
        }

        // Find added or modified environment variables
        for (const [name, value] of targetEnvMap) {
          if (!currentEnvMap.has(name)) {
            diffs.push({
              path: `containerDefinitions[${currentContainer.name}].environment[${name}]`,
              current: undefined,
              target: value,
              type: "Added"
            });
          } else if (currentEnvMap.get(name) !== value) {
            diffs.push({
              path: `containerDefinitions[${currentContainer.name}].environment[${name}]`,
              current: currentEnvMap.get(name),
              target: value,
              type: "Modified"
            });
          }
        }

        // Compare port mappings
        const currentPorts = currentContainer.portMappings || [];
        const targetPorts = targetContainer.portMappings || [];

        if (JSON.stringify(currentPorts) !== JSON.stringify(targetPorts)) {
          diffs.push({
            path: `containerDefinitions[${currentContainer.name}].portMappings`,
            current: JSON.stringify(currentPorts),
            target: JSON.stringify(targetPorts),
            type: "Modified"
          });
        }
      }
    }

    return diffs;
  }
}
