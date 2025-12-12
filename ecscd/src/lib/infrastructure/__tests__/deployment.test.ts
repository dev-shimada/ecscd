import { Deployment } from "../deployment";
import { IAws } from "../interface/aws";
import { IGithub } from "../interface/github";
import { ApplicationDomain } from "../../domain/application";
import { RegisterTaskDefinitionCommandInput } from "@aws-sdk/client-ecs";

// Mock implementations
class MockAws implements IAws {
  createECSClient = jest.fn();
  registerTaskDefinition = jest.fn();
  updateService = jest.fn();
  stopServiceDeployment = jest.fn();
  describeServices = jest.fn();
  describeTaskDefinition = jest.fn();
}

class MockGithub implements IGithub {
  getFileContent = jest.fn();
}

describe("Deployment.diff", () => {
  let deployment: Deployment;
  let mockAws: MockAws;
  let mockGithub: MockGithub;
  let mockApplication: ApplicationDomain;

  beforeEach(() => {
    mockAws = new MockAws();
    mockGithub = new MockGithub();
    deployment = new Deployment(mockAws, mockGithub);

    mockApplication = {
      name: "test-app",
      sync: {
        status: "InSync",
        lastSyncedAt: new Date(),
      },
      gitConfig: {
        repo: "test/repo",
        branch: "main",
        path: "task-definition.json",
      },
      ecsConfig: {
        cluster: "test-cluster",
        service: "test-service",
      },
      awsConfig: {
        region: "us-east-1",
        roleArn: "arn:aws:iam::123456789012:role/test-role",
        externalId: "test-external-id",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Error handling", () => {
    it("should throw error when task definition file is not found", async () => {
      mockGithub.getFileContent.mockResolvedValue(null);

      await expect(deployment.diff(mockApplication)).rejects.toThrow(
        "Task definition file not found"
      );
    });

    it("should throw error when ECS service is not found", async () => {
      const mockTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(mockTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue(null);

      await expect(deployment.diff(mockApplication)).rejects.toThrow(
        "ECS Service not found"
      );
    });

    it("should throw error when current task definition ARN is not found", async () => {
      const mockTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(mockTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "",
        deployments: [],
      });

      await expect(deployment.diff(mockApplication)).rejects.toThrow(
        "Current task definition ARN not found"
      );
    });

    it("should throw error when current task definition is not found", async () => {
      const mockTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(mockTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(null);

      await expect(deployment.diff(mockApplication)).rejects.toThrow(
        "Current task definition not found"
      );
    });
  });

  describe("Task definition field comparisons", () => {
    it("should detect no differences when task definitions are identical", async () => {
      const taskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        cpu: "256",
        memory: "512",
        networkMode: "awsvpc",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(taskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(taskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([]);
    });

    it("should detect family change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "old-family",
        containerDefinitions: [],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "new-family",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "family",
          current: "old-family",
          target: "new-family",
          type: "Modified",
        },
      ]);
    });

    it("should detect CPU change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        cpu: "256",
        containerDefinitions: [],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        cpu: "512",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "cpu",
          current: "256",
          target: "512",
          type: "Modified",
        },
      ]);
    });

    it("should detect memory change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        memory: "512",
        containerDefinitions: [],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        memory: "1024",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "memory",
          current: "512",
          target: "1024",
          type: "Modified",
        },
      ]);
    });

    it("should detect network mode change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        networkMode: "bridge",
        containerDefinitions: [],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        networkMode: "awsvpc",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "networkMode",
          current: "bridge",
          target: "awsvpc",
          type: "Modified",
        },
      ]);
    });

    it("should detect execution role ARN change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        executionRoleArn: "arn:aws:iam::123456789012:role/old-role",
        containerDefinitions: [],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        executionRoleArn: "arn:aws:iam::123456789012:role/new-role",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "executionRoleArn",
          current: "arn:aws:iam::123456789012:role/old-role",
          target: "arn:aws:iam::123456789012:role/new-role",
          type: "Modified",
        },
      ]);
    });

    it("should detect task role ARN change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        taskRoleArn: "arn:aws:iam::123456789012:role/old-task-role",
        containerDefinitions: [],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        taskRoleArn: "arn:aws:iam::123456789012:role/new-task-role",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "taskRoleArn",
          current: "arn:aws:iam::123456789012:role/old-task-role",
          target: "arn:aws:iam::123456789012:role/new-task-role",
          type: "Modified",
        },
      ]);
    });

    it("should detect multiple field changes", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "old-family",
        cpu: "256",
        memory: "512",
        containerDefinitions: [],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "new-family",
        cpu: "512",
        memory: "1024",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toHaveLength(3);
      expect(diffs).toContainEqual({
        path: "family",
        current: "old-family",
        target: "new-family",
        type: "Modified",
      });
      expect(diffs).toContainEqual({
        path: "cpu",
        current: "256",
        target: "512",
        type: "Modified",
      });
      expect(diffs).toContainEqual({
        path: "memory",
        current: "512",
        target: "1024",
        type: "Modified",
      });
    });
  });

  describe("Container definition comparisons", () => {
    it("should detect removed container", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].path).toBe("containerDefinitions[web]");
      expect(diffs[0].type).toBe("Removed");
    });

    it("should detect added container", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].path).toBe("containerDefinitions[web]");
      expect(diffs[0].type).toBe("Added");
    });

    it("should detect container image change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:1.20",
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:1.21",
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].image",
          current: "nginx:1.20",
          target: "nginx:1.21",
          type: "Modified",
        },
      ]);
    });

    it("should detect container CPU change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            cpu: 256,
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            cpu: 512,
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].cpu",
          current: "256",
          target: "512",
          type: "Modified",
        },
      ]);
    });

    it("should detect container memory change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            memory: 512,
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            memory: 1024,
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].memory",
          current: "512",
          target: "1024",
          type: "Modified",
        },
      ]);
    });

    it("should detect container memory reservation change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            memoryReservation: 256,
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            memoryReservation: 512,
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].memoryReservation",
          current: "256",
          target: "512",
          type: "Modified",
        },
      ]);
    });

    it("should detect container essential flag change", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            essential: true,
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            essential: false,
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].essential",
          current: "true",
          target: "false",
          type: "Modified",
        },
      ]);
    });
  });

  describe("Environment variable comparisons", () => {
    it("should detect removed environment variable", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            environment: [
              { name: "ENV_VAR", value: "value" },
            ],
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            environment: [],
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].environment[ENV_VAR]",
          current: "value",
          target: undefined,
          type: "Removed",
        },
      ]);
    });

    it("should detect added environment variable", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            environment: [],
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            environment: [
              { name: "NEW_VAR", value: "new_value" },
            ],
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].environment[NEW_VAR]",
          current: undefined,
          target: "new_value",
          type: "Added",
        },
      ]);
    });

    it("should detect modified environment variable", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            environment: [
              { name: "ENV_VAR", value: "old_value" },
            ],
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            environment: [
              { name: "ENV_VAR", value: "new_value" },
            ],
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].environment[ENV_VAR]",
          current: "old_value",
          target: "new_value",
          type: "Modified",
        },
      ]);
    });

    it("should detect multiple environment variable changes", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            environment: [
              { name: "VAR1", value: "value1" },
              { name: "VAR2", value: "old_value" },
            ],
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            environment: [
              { name: "VAR2", value: "new_value" },
              { name: "VAR3", value: "value3" },
            ],
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toHaveLength(3);
      expect(diffs).toContainEqual({
        path: "containerDefinitions[web].environment[VAR1]",
        current: "value1",
        target: undefined,
        type: "Removed",
      });
      expect(diffs).toContainEqual({
        path: "containerDefinitions[web].environment[VAR2]",
        current: "old_value",
        target: "new_value",
        type: "Modified",
      });
      expect(diffs).toContainEqual({
        path: "containerDefinitions[web].environment[VAR3]",
        current: undefined,
        target: "value3",
        type: "Added",
      });
    });
  });

  describe("Secrets comparisons", () => {
    it("should detect removed secret", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            secrets: [
              { name: "DB_PASSWORD", valueFrom: "dummy-secret" },
            ],
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            secrets: [],
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].secrets[DB_PASSWORD]",
          current: "dummy-secret",
          target: undefined,
          type: "Removed",
        },
      ]);
    });

    it("should detect added secret", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            secrets: [],
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            secrets: [
              { name: "API_KEY", valueFrom: "arn:aws:secretsmanager:us-east-1:123456789012:secret:api-key" },
            ],
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].secrets[API_KEY]",
          current: undefined,
          target: "arn:aws:secretsmanager:us-east-1:123456789012:secret:api-key",
          type: "Added",
        },
      ]);
    });

    it("should detect modified secret", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            secrets: [
              { name: "DB_PASSWORD", valueFrom: "dummy-secret" },
            ],
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            secrets: [
              { name: "DB_PASSWORD", valueFrom: "dummy-secret" },
            ],
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([
        {
          path: "containerDefinitions[web].secrets[DB_PASSWORD]",
          current: "dummy-secret",
          target: "dummy-secret",
          type: "Modified",
        },
      ]);
    });

    it("should detect multiple secret changes", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            secrets: [
              { name: "SECRET1", valueFrom: "arn:aws:secretsmanager:us-east-1:123456789012:secret:secret1" },
              { name: "SECRET2", valueFrom: "arn:aws:secretsmanager:us-east-1:123456789012:secret:old-secret2" },
            ],
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            secrets: [
              { name: "SECRET2", valueFrom: "arn:aws:secretsmanager:us-east-1:123456789012:secret:new-secret2" },
              { name: "SECRET3", valueFrom: "arn:aws:secretsmanager:us-east-1:123456789012:secret:secret3" },
            ],
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toHaveLength(3);
      expect(diffs).toContainEqual({
        path: "containerDefinitions[web].secrets[SECRET1]",
        current: "arn:aws:secretsmanager:us-east-1:123456789012:secret:secret1",
        target: undefined,
        type: "Removed",
      });
      expect(diffs).toContainEqual({
        path: "containerDefinitions[web].secrets[SECRET2]",
        current: "arn:aws:secretsmanager:us-east-1:123456789012:secret:old-secret2",
        target: "arn:aws:secretsmanager:us-east-1:123456789012:secret:new-secret2",
        type: "Modified",
      });
      expect(diffs).toContainEqual({
        path: "containerDefinitions[web].secrets[SECRET3]",
        current: undefined,
        target: "arn:aws:secretsmanager:us-east-1:123456789012:secret:secret3",
        type: "Added",
      });
    });
  });

  describe("Port mapping comparisons", () => {
    it("should detect port mapping changes", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            portMappings: [
              {
                containerPort: 80,
                protocol: "tcp",
              },
            ],
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            portMappings: [
              {
                containerPort: 8080,
                protocol: "tcp",
              },
            ],
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].path).toBe("containerDefinitions[web].portMappings");
      expect(diffs[0].type).toBe("Modified");
    });

    it("should detect no change when port mappings are identical", async () => {
      const portMappings = [
        {
          containerPort: 80,
          protocol: "tcp",
        },
      ];

      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            portMappings,
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:latest",
            portMappings,
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toEqual([]);
    });
  });

  describe("Multiple container comparisons", () => {
    it("should detect changes across multiple containers", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:1.20",
          },
          {
            name: "app",
            image: "node:14",
          },
        ],
      };
      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "test-family",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:1.21",
          },
          {
            name: "app",
            image: "node:16",
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      expect(diffs).toHaveLength(2);
      expect(diffs).toContainEqual({
        path: "containerDefinitions[web].image",
        current: "nginx:1.20",
        target: "nginx:1.21",
        type: "Modified",
      });
      expect(diffs).toContainEqual({
        path: "containerDefinitions[app].image",
        current: "node:14",
        target: "node:16",
        type: "Modified",
      });
    });
  });

  describe("Complex scenarios", () => {
    it("should handle complex task definition with multiple changes", async () => {
      const currentTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "old-family",
        cpu: "256",
        memory: "512",
        networkMode: "bridge",
        executionRoleArn: "arn:aws:iam::123456789012:role/old-exec-role",
        taskRoleArn: "arn:aws:iam::123456789012:role/old-task-role",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:1.20",
            cpu: 128,
            memory: 256,
            essential: true,
            environment: [
              { name: "ENV1", value: "value1" },
            ],
            portMappings: [
              {
                containerPort: 80,
                protocol: "tcp",
              },
            ],
          },
        ],
      };

      const targetTaskDef: RegisterTaskDefinitionCommandInput = {
        family: "new-family",
        cpu: "512",
        memory: "1024",
        networkMode: "awsvpc",
        executionRoleArn: "arn:aws:iam::123456789012:role/new-exec-role",
        taskRoleArn: "arn:aws:iam::123456789012:role/new-task-role",
        containerDefinitions: [
          {
            name: "web",
            image: "nginx:1.21",
            cpu: 256,
            memory: 512,
            essential: true,
            environment: [
              { name: "ENV1", value: "new_value1" },
              { name: "ENV2", value: "value2" },
            ],
            portMappings: [
              {
                containerPort: 8080,
                protocol: "tcp",
              },
            ],
          },
          {
            name: "sidecar",
            image: "datadog/agent:latest",
          },
        ],
      };

      mockGithub.getFileContent.mockResolvedValue(targetTaskDef);
      mockAws.createECSClient.mockResolvedValue({});
      mockAws.describeServices.mockResolvedValue({
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        taskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/test:1",
        deployments: [],
      });
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDef);

      const diffs = await deployment.diff(mockApplication);

      // Should detect changes in:
      // - family, cpu, memory, networkMode, executionRoleArn, taskRoleArn
      // - web container: image, cpu, memory, env variable modified, env variable added, port mappings
      // - sidecar container: added
      expect(diffs.length).toBeGreaterThan(10);

      // Check task-level changes
      expect(diffs).toContainEqual({
        path: "family",
        current: "old-family",
        target: "new-family",
        type: "Modified",
      });

      // Check container changes
      expect(diffs).toContainEqual({
        path: "containerDefinitions[web].image",
        current: "nginx:1.20",
        target: "nginx:1.21",
        type: "Modified",
      });

      // Check new container
      expect(diffs.some(d => d.path === "containerDefinitions[sidecar]" && d.type === "Added")).toBe(true);
    });
  });
});
