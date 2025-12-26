import { Deployment } from "../deployment";
import { IAws } from "../interface/aws";
import { IGithub } from "../interface/github";
import { ApplicationDomain } from "../../domain/application";
import { RegisterTaskDefinitionCommandInput } from "@aws-sdk/client-ecs";

describe("Deployment", () => {
  let deployment: Deployment;
  let mockAws: jest.Mocked<IAws>;
  let mockGithub: jest.Mocked<IGithub>;

  beforeEach(() => {
    mockAws = {
      createECSClient: jest.fn(),
      registerTaskDefinition: jest.fn(),
      updateService: jest.fn(),
      stopServiceDeployment: jest.fn(),
      describeServices: jest.fn(),
      describeTaskDefinition: jest.fn(),
    };

    mockGithub = {
      getFileContent: jest.fn(),
    };

    deployment = new Deployment(mockAws, mockGithub);
  });

  describe("diff method", () => {
    it("should generate diffs for all RegisterTaskDefinitionCommandInput fields when everything is different", async () => {
      // Test application
      const application: ApplicationDomain = {
        id: "test-app",
        name: "test-app",
        repositoryUrl: "https://github.com/test/repo",
        branch: "main",
        taskDefinitionPath: "task-definition.json",
        awsConfig: {
          region: "us-east-1",
          accessKeyId: "key",
          secretAccessKey: "secret",
        },
        ecsConfig: {
          clusterName: "test-cluster",
          serviceName: "test-service",
        },
      };

      // Current task definition (comprehensive with all possible fields)
      const currentTaskDefinition: RegisterTaskDefinitionCommandInput = {
        family: "current-family",
        taskRoleArn: "arn:aws:iam::123456789012:role/current-task-role",
        executionRoleArn:
          "arn:aws:iam::123456789012:role/current-execution-role",
        networkMode: "awsvpc",
        requiresCompatibilities: ["FARGATE"],
        cpu: "256",
        memory: "512",
        volumes: [
          {
            name: "current-volume",
            host: {
              sourcePath: "/current/path",
            },
          },
          {
            name: "current-efs-volume",
            efsVolumeConfiguration: {
              fileSystemId: "fs-current123",
              rootDirectory: "/current",
              transitEncryption: "ENABLED",
              transitEncryptionPort: 2049,
              authorizationConfig: {
                accessPointId: "fsap-current123",
                iam: "ENABLED",
              },
            },
          },
        ],
        containerDefinitions: [
          {
            name: "current-container",
            image: "nginx:1.20",
            cpu: 128,
            memory: 256,
            memoryReservation: 128,
            links: ["current-link"],
            portMappings: [
              {
                containerPort: 80,
                hostPort: 8080,
                protocol: "tcp",
              },
            ],
            essential: true,
            entryPoint: ["current-entrypoint"],
            command: ["current-command"],
            environment: [
              {
                name: "CURRENT_ENV",
                value: "current-value",
              },
            ],
            secrets: [
              {
                name: "CURRENT_SECRET",
                valueFrom:
                  "arn:aws:secretsmanager:us-east-1:123456789012:secret:current-secret",
              },
            ],
            mountPoints: [
              {
                sourceVolume: "current-volume",
                containerPath: "/current/mount",
                readOnly: false,
              },
            ],
            volumesFrom: [
              {
                sourceContainer: "current-source",
                readOnly: false,
              },
            ],
            hostname: "current-hostname",
            user: "current-user",
            workingDirectory: "/current/workdir",
            disableNetworking: false,
            privileged: false,
            readonlyRootFilesystem: false,
            dnsServers: ["8.8.8.8"],
            dnsSearchDomains: ["current.domain"],
            extraHosts: [
              {
                hostname: "current.extra.host",
                ipAddress: "192.168.1.1",
              },
            ],
            dockerSecurityOptions: ["current-security-option"],
            dockerLabels: {
              "current.label": "current-value",
            },
            ulimits: [
              {
                name: "nofile",
                softLimit: 1024,
                hardLimit: 2048,
              },
            ],
            logConfiguration: {
              logDriver: "awslogs",
              options: {
                "awslogs-group": "/current/log-group",
                "awslogs-region": "us-east-1",
              },
            },
            healthCheck: {
              command: ["CMD-SHELL", "current health check"],
              interval: 30,
              timeout: 5,
              retries: 3,
              startPeriod: 60,
            },
            systemControls: [
              {
                namespace: "current.namespace",
                value: "current-system-value",
              },
            ],
            resourceRequirements: [
              {
                type: "GPU",
                value: "1",
              },
            ],
            firelensConfiguration: {
              type: "fluentd",
              options: {
                "current-option": "current-value",
              },
            },
            dependsOn: [
              {
                containerName: "current-dependency",
                condition: "START",
              },
            ],
            startTimeout: 120,
            stopTimeout: 30,
            interactive: false,
            pseudoTerminal: false,
            repositoryCredentials: {
              credentialsParameter:
                "arn:aws:secretsmanager:us-east-1:123456789012:secret:current-creds",
            },
          },
        ],
        placementConstraints: [
          {
            type: "memberOf",
            expression: "attribute:current-attribute == current-value",
          },
        ],
        tags: [
          {
            key: "Current",
            value: "current-tag-value",
          },
        ],
        pidMode: "task",
        ipcMode: "task",
        proxyConfiguration: {
          type: "APPMESH",
          containerName: "current-proxy",
          properties: [
            {
              name: "current-proxy-prop",
              value: "current-proxy-value",
            },
          ],
        },
        inferenceAccelerators: [
          {
            deviceName: "current-device",
            deviceType: "eia2.medium",
          },
        ],
        ephemeralStorage: {
          sizeInGiB: 20,
        },
        runtimePlatform: {
          cpuArchitecture: "X86_64",
          operatingSystemFamily: "LINUX",
        },
      };

      // Target task definition (different in all possible fields)
      const targetTaskDefinition: RegisterTaskDefinitionCommandInput = {
        family: "target-family",
        taskRoleArn: "arn:aws:iam::123456789012:role/target-task-role",
        executionRoleArn:
          "arn:aws:iam::123456789012:role/target-execution-role",
        networkMode: "bridge",
        requiresCompatibilities: ["EC2"],
        cpu: "512",
        memory: "1024",
        volumes: [
          {
            name: "target-volume",
            host: {
              sourcePath: "/target/path",
            },
          },
          {
            name: "target-efs-volume",
            efsVolumeConfiguration: {
              fileSystemId: "fs-target456",
              rootDirectory: "/target",
              transitEncryption: "DISABLED",
              transitEncryptionPort: 2050,
              authorizationConfig: {
                accessPointId: "fsap-target456",
                iam: "DISABLED",
              },
            },
          },
        ],
        containerDefinitions: [
          {
            name: "target-container",
            image: "nginx:1.21",
            cpu: 256,
            memory: 512,
            memoryReservation: 256,
            links: ["target-link"],
            portMappings: [
              {
                containerPort: 443,
                hostPort: 8443,
                protocol: "udp",
              },
            ],
            essential: false,
            entryPoint: ["target-entrypoint"],
            command: ["target-command"],
            environment: [
              {
                name: "TARGET_ENV",
                value: "target-value",
              },
            ],
            secrets: [
              {
                name: "TARGET_SECRET",
                valueFrom:
                  "arn:aws:secretsmanager:us-east-1:123456789012:secret:target-secret",
              },
            ],
            mountPoints: [
              {
                sourceVolume: "target-volume",
                containerPath: "/target/mount",
                readOnly: true,
              },
            ],
            volumesFrom: [
              {
                sourceContainer: "target-source",
                readOnly: true,
              },
            ],
            hostname: "target-hostname",
            user: "target-user",
            workingDirectory: "/target/workdir",
            disableNetworking: true,
            privileged: true,
            readonlyRootFilesystem: true,
            dnsServers: ["8.8.4.4"],
            dnsSearchDomains: ["target.domain"],
            extraHosts: [
              {
                hostname: "target.extra.host",
                ipAddress: "192.168.1.2",
              },
            ],
            dockerSecurityOptions: ["target-security-option"],
            dockerLabels: {
              "target.label": "target-value",
            },
            ulimits: [
              {
                name: "nproc",
                softLimit: 2048,
                hardLimit: 4096,
              },
            ],
            logConfiguration: {
              logDriver: "syslog",
              options: {
                "syslog-address": "tcp://target-server:514",
                tag: "target-tag",
              },
            },
            healthCheck: {
              command: ["CMD-SHELL", "target health check"],
              interval: 60,
              timeout: 10,
              retries: 5,
              startPeriod: 120,
            },
            systemControls: [
              {
                namespace: "target.namespace",
                value: "target-system-value",
              },
            ],
            resourceRequirements: [
              {
                type: "InferenceAccelerator",
                value: "target-accelerator",
              },
            ],
            firelensConfiguration: {
              type: "fluentbit",
              options: {
                "target-option": "target-value",
              },
            },
            dependsOn: [
              {
                containerName: "target-dependency",
                condition: "HEALTHY",
              },
            ],
            startTimeout: 240,
            stopTimeout: 60,
            interactive: true,
            pseudoTerminal: true,
            repositoryCredentials: {
              credentialsParameter:
                "arn:aws:secretsmanager:us-east-1:123456789012:secret:target-creds",
            },
          },
        ],
        placementConstraints: [
          {
            type: "distinctInstance",
            expression: "attribute:target-attribute == target-value",
          },
        ],
        tags: [
          {
            key: "Target",
            value: "target-tag-value",
          },
        ],
        pidMode: "host",
        ipcMode: "host",
        proxyConfiguration: {
          type: "APPMESH",
          containerName: "target-proxy",
          properties: [
            {
              name: "target-proxy-prop",
              value: "target-proxy-value",
            },
          ],
        },
        inferenceAccelerators: [
          {
            deviceName: "target-device",
            deviceType: "eia2.large",
          },
        ],
        ephemeralStorage: {
          sizeInGiB: 40,
        },
        runtimePlatform: {
          cpuArchitecture: "ARM64",
          operatingSystemFamily: "WINDOWS_SERVER_2019_CORE",
        },
      };

      // Mock the service with current task definition
      const mockService = {
        taskDefinition:
          "arn:aws:ecs:us-east-1:123456789012:task-definition/current-family:1",
      };

      // Setup mocks
      mockGithub.getFileContent.mockResolvedValue(targetTaskDefinition);
      mockAws.createECSClient.mockResolvedValue({} as any);
      mockAws.describeServices.mockResolvedValue(mockService as any);
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDefinition);

      // Execute diff
      const diffs = await deployment.diff(application);

      // Verify the results
      expect(diffs).toBeDefined();
      expect(diffs.length).toBeGreaterThan(150); // Should have many diffs since everything is different

      // Check some key differences
      const familyDiff = diffs.find((d) => d.path === "family");
      expect(familyDiff).toEqual({
        path: "family",
        current: "current-family",
        target: "target-family",
        type: "Modified",
      });

      const taskRoleArnDiff = diffs.find((d) => d.path === "taskRoleArn");
      expect(taskRoleArnDiff).toEqual({
        path: "taskRoleArn",
        current: "arn:aws:iam::123456789012:role/current-task-role",
        target: "arn:aws:iam::123456789012:role/target-task-role",
        type: "Modified",
      });

      const executionRoleArnDiff = diffs.find(
        (d) => d.path === "executionRoleArn"
      );
      expect(executionRoleArnDiff).toEqual({
        path: "executionRoleArn",
        current: "arn:aws:iam::123456789012:role/current-execution-role",
        target: "arn:aws:iam::123456789012:role/target-execution-role",
        type: "Modified",
      });

      const networkModeDiff = diffs.find((d) => d.path === "networkMode");
      expect(networkModeDiff).toEqual({
        path: "networkMode",
        current: "awsvpc",
        target: "bridge",
        type: "Modified",
      });

      const requiresCompatibilitiesDiff = diffs.find(
        (d) => d.path === "requiresCompatibilities"
      );
      expect(requiresCompatibilitiesDiff).toEqual({
        path: "requiresCompatibilities",
        current: "FARGATE",
        target: "EC2",
        type: "Modified",
      });

      const cpuDiff = diffs.find((d) => d.path === "cpu");
      expect(cpuDiff).toEqual({
        path: "cpu",
        current: "256",
        target: "512",
        type: "Modified",
      });

      const memoryDiff = diffs.find((d) => d.path === "memory");
      expect(memoryDiff).toEqual({
        path: "memory",
        current: "512",
        target: "1024",
        type: "Modified",
      });

      // Check container definition differences - they should show as removed/added since names differ
      const containerImageDiff = diffs.find(
        (d) => d.path === "containerDefinitions.current-container.image"
      );
      expect(containerImageDiff).toEqual({
        path: "containerDefinitions.current-container.image",
        current: "nginx:1.20",
        target: undefined,
        type: "Removed",
      });

      const targetContainerImageDiff = diffs.find(
        (d) => d.path === "containerDefinitions.target-container.image"
      );
      expect(targetContainerImageDiff).toEqual({
        path: "containerDefinitions.target-container.image",
        current: undefined,
        target: "nginx:1.21",
        type: "Added",
      });

      // Check volume differences - they should show as removed/added since names differ
      const volumeNameDiff = diffs.find(
        (d) => d.path === "volumes.current-volume.name"
      );
      expect(volumeNameDiff).toEqual({
        path: "volumes.current-volume.name",
        current: "current-volume",
        target: undefined,
        type: "Removed",
      });

      const targetVolumeNameDiff = diffs.find(
        (d) => d.path === "volumes.target-volume.name"
      );
      expect(targetVolumeNameDiff).toEqual({
        path: "volumes.target-volume.name",
        current: undefined,
        target: "target-volume",
        type: "Added",
      });

      // Check environment variable differences
      const currentEnvDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.current-container.environment.CURRENT_ENV"
      );
      expect(currentEnvDiff).toEqual({
        path: "containerDefinitions.current-container.environment.CURRENT_ENV",
        current: "current-value",
        target: undefined,
        type: "Removed",
      });

      const targetEnvDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.target-container.environment.TARGET_ENV"
      );
      expect(targetEnvDiff).toEqual({
        path: "containerDefinitions.target-container.environment.TARGET_ENV",
        current: undefined,
        target: "target-value",
        type: "Added",
      });

      // Check placement constraints differences
      const currentPlacementConstraintDiff = diffs.find(
        (d) => d.path === "placementConstraints.memberOf.type"
      );
      expect(currentPlacementConstraintDiff).toEqual({
        path: "placementConstraints.memberOf.type",
        current: "memberOf",
        target: undefined,
        type: "Removed",
      });

      const targetPlacementConstraintDiff = diffs.find(
        (d) => d.path === "placementConstraints.distinctInstance.type"
      );
      expect(targetPlacementConstraintDiff).toEqual({
        path: "placementConstraints.distinctInstance.type",
        current: undefined,
        target: "distinctInstance",
        type: "Added",
      });

      // Check ephemeral storage differences
      const ephemeralStorageDiff = diffs.find(
        (d) => d.path === "ephemeralStorage.sizeInGiB"
      );
      expect(ephemeralStorageDiff).toEqual({
        path: "ephemeralStorage.sizeInGiB",
        current: "20",
        target: "40",
        type: "Modified",
      });

      // Check runtime platform differences
      const cpuArchitectureDiff = diffs.find(
        (d) => d.path === "runtimePlatform.cpuArchitecture"
      );
      expect(cpuArchitectureDiff).toEqual({
        path: "runtimePlatform.cpuArchitecture",
        current: "X86_64",
        target: "ARM64",
        type: "Modified",
      });

      const osFamilyDiff = diffs.find(
        (d) => d.path === "runtimePlatform.operatingSystemFamily"
      );
      expect(osFamilyDiff).toEqual({
        path: "runtimePlatform.operatingSystemFamily",
        current: "LINUX",
        target: "WINDOWS_SERVER_2019_CORE",
        type: "Modified",
      });

      // Check tags differences - tags use key as path and value as the value
      const currentTagDiff = diffs.find((d) => d.path === "tags.Current");
      expect(currentTagDiff).toEqual({
        path: "tags.Current",
        current: "current-tag-value",
        target: undefined,
        type: "Removed",
      });

      const targetTagDiff = diffs.find((d) => d.path === "tags.Target");
      expect(targetTagDiff).toEqual({
        path: "tags.Target",
        current: undefined,
        target: "target-tag-value",
        type: "Added",
      });

      // Check proxy configuration differences
      const proxyContainerDiff = diffs.find(
        (d) => d.path === "proxyConfiguration.containerName"
      );
      expect(proxyContainerDiff).toEqual({
        path: "proxyConfiguration.containerName",
        current: "current-proxy",
        target: "target-proxy",
        type: "Modified",
      });

      // Check inference accelerator differences
      const deviceNameDiff = diffs.find(
        (d) => d.path === "inferenceAccelerators.0.deviceName"
      );
      expect(deviceNameDiff).toEqual({
        path: "inferenceAccelerators.0.deviceName",
        current: "current-device",
        target: "target-device",
        type: "Modified",
      });

      // Check pid and ipc mode differences
      const pidModeDiff = diffs.find((d) => d.path === "pidMode");
      expect(pidModeDiff).toEqual({
        path: "pidMode",
        current: "task",
        target: "host",
        type: "Modified",
      });

      const ipcModeDiff = diffs.find((d) => d.path === "ipcMode");
      expect(ipcModeDiff).toEqual({
        path: "ipcMode",
        current: "task",
        target: "host",
        type: "Modified",
      });

      // Check specific container configuration differences
      const containerCpuDiff = diffs.find(
        (d) => d.path === "containerDefinitions.current-container.cpu"
      );
      expect(containerCpuDiff).toEqual({
        path: "containerDefinitions.current-container.cpu",
        current: "128",
        target: undefined,
        type: "Removed",
      });

      const targetContainerCpuDiff = diffs.find(
        (d) => d.path === "containerDefinitions.target-container.cpu"
      );
      expect(targetContainerCpuDiff).toEqual({
        path: "containerDefinitions.target-container.cpu",
        current: undefined,
        target: "256",
        type: "Added",
      });

      // Check health check differences
      const healthCheckCommandDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.current-container.healthCheck.command"
      );
      expect(healthCheckCommandDiff).toEqual({
        path: "containerDefinitions.current-container.healthCheck.command",
        current: "CMD-SHELL,current health check",
        target: undefined,
        type: "Removed",
      });

      const targetHealthCheckCommandDiff = diffs.find(
        (d) =>
          d.path === "containerDefinitions.target-container.healthCheck.command"
      );
      expect(targetHealthCheckCommandDiff).toEqual({
        path: "containerDefinitions.target-container.healthCheck.command",
        current: undefined,
        target: "CMD-SHELL,target health check",
        type: "Added",
      });

      // Check ulimits differences
      const ulimitsDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.current-container.ulimits.nofile.name"
      );
      expect(ulimitsDiff).toEqual({
        path: "containerDefinitions.current-container.ulimits.nofile.name",
        current: "nofile",
        target: undefined,
        type: "Removed",
      });

      const targetUlimitsDiff = diffs.find(
        (d) =>
          d.path === "containerDefinitions.target-container.ulimits.nproc.name"
      );
      expect(targetUlimitsDiff).toEqual({
        path: "containerDefinitions.target-container.ulimits.nproc.name",
        current: undefined,
        target: "nproc",
        type: "Added",
      });

      // Check secrets differences
      const secretsDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.current-container.secrets.CURRENT_SECRET"
      );
      expect(secretsDiff).toEqual({
        path: "containerDefinitions.current-container.secrets.CURRENT_SECRET",
        current:
          "arn:aws:secretsmanager:us-east-1:123456789012:secret:current-secret",
        target: undefined,
        type: "Removed",
      });

      const targetSecretsDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.target-container.secrets.TARGET_SECRET"
      );
      expect(targetSecretsDiff).toEqual({
        path: "containerDefinitions.target-container.secrets.TARGET_SECRET",
        current: undefined,
        target:
          "arn:aws:secretsmanager:us-east-1:123456789012:secret:target-secret",
        type: "Added",
      });

      // Check port mapping differences
      const portMappingDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.current-container.portMappings.80.containerPort"
      );
      expect(portMappingDiff).toEqual({
        path: "containerDefinitions.current-container.portMappings.80.containerPort",
        current: "80",
        target: undefined,
        type: "Removed",
      });

      const targetPortMappingDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.target-container.portMappings.443.containerPort"
      );
      expect(targetPortMappingDiff).toEqual({
        path: "containerDefinitions.target-container.portMappings.443.containerPort",
        current: undefined,
        target: "443",
        type: "Added",
      });

      // Check DNS configuration differences
      const dnsServersDiff = diffs.find(
        (d) => d.path === "containerDefinitions.current-container.dnsServers"
      );
      expect(dnsServersDiff).toEqual({
        path: "containerDefinitions.current-container.dnsServers",
        current: "8.8.8.8",
        target: undefined,
        type: "Removed",
      });

      const targetDnsServersDiff = diffs.find(
        (d) => d.path === "containerDefinitions.target-container.dnsServers"
      );
      expect(targetDnsServersDiff).toEqual({
        path: "containerDefinitions.target-container.dnsServers",
        current: undefined,
        target: "8.8.4.4",
        type: "Added",
      });

      // Check EFS volume configuration differences
      const efsFileSystemIdDiff = diffs.find(
        (d) =>
          d.path ===
          "volumes.current-efs-volume.efsVolumeConfiguration.fileSystemId"
      );
      expect(efsFileSystemIdDiff).toEqual({
        path: "volumes.current-efs-volume.efsVolumeConfiguration.fileSystemId",
        current: "fs-current123",
        target: undefined,
        type: "Removed",
      });

      const targetEfsFileSystemIdDiff = diffs.find(
        (d) =>
          d.path ===
          "volumes.target-efs-volume.efsVolumeConfiguration.fileSystemId"
      );
      expect(targetEfsFileSystemIdDiff).toEqual({
        path: "volumes.target-efs-volume.efsVolumeConfiguration.fileSystemId",
        current: undefined,
        target: "fs-target456",
        type: "Added",
      });

      // Verify mocks were called correctly
      expect(mockGithub.getFileContent).toHaveBeenCalledWith(application);
      expect(mockAws.createECSClient).toHaveBeenCalledWith(
        application.awsConfig
      );
      expect(mockAws.describeServices).toHaveBeenCalledWith(
        expect.anything(),
        application.ecsConfig
      );
      expect(mockAws.describeTaskDefinition).toHaveBeenCalledWith(
        expect.anything(),
        "arn:aws:ecs:us-east-1:123456789012:task-definition/current-family:1"
      );
    });

    it("should generate only Modified diffs when all fields exist in both task definitions but with different values", async () => {
      // Test application
      const application: ApplicationDomain = {
        id: "test-app",
        name: "test-app",
        repositoryUrl: "https://github.com/test/repo",
        branch: "main",
        taskDefinitionPath: "task-definition.json",
        awsConfig: {
          region: "us-east-1",
          accessKeyId: "key",
          secretAccessKey: "secret",
        },
        ecsConfig: {
          clusterName: "test-cluster",
          serviceName: "test-service",
        },
      };

      // Current task definition with same structure as target but different values
      const currentTaskDefinition: RegisterTaskDefinitionCommandInput = {
        family: "web-app",
        taskRoleArn: "arn:aws:iam::123456789012:role/web-task-role",
        executionRoleArn: "arn:aws:iam::123456789012:role/web-execution-role",
        networkMode: "awsvpc",
        requiresCompatibilities: ["FARGATE"],
        cpu: "256",
        memory: "512",
        volumes: [
          {
            name: "app-volume",
            host: {
              sourcePath: "/app/data",
            },
          },
        ],
        containerDefinitions: [
          {
            name: "web-container",
            image: "nginx:1.20",
            cpu: 128,
            memory: 256,
            essential: true,
            portMappings: [
              {
                containerPort: 80,
                hostPort: 8080,
                protocol: "tcp",
              },
            ],
            environment: [
              {
                name: "NODE_ENV",
                value: "development",
              },
              {
                name: "PORT",
                value: "3000",
              },
            ],
            secrets: [
              {
                name: "DATABASE_URL",
                valueFrom:
                  "arn:aws:secretsmanager:us-east-1:123456789012:secret:dev-db-url",
              },
            ],
            mountPoints: [
              {
                sourceVolume: "app-volume",
                containerPath: "/app/data",
                readOnly: false,
              },
            ],
            logConfiguration: {
              logDriver: "awslogs",
              options: {
                "awslogs-group": "/dev/web-app",
                "awslogs-region": "us-east-1",
                "awslogs-stream-prefix": "dev",
              },
            },
            healthCheck: {
              command: [
                "CMD-SHELL",
                "curl -f http://localhost:3000/health || exit 1",
              ],
              interval: 30,
              timeout: 5,
              retries: 3,
              startPeriod: 60,
            },
            ulimits: [
              {
                name: "nofile",
                softLimit: 1024,
                hardLimit: 2048,
              },
            ],
            workingDirectory: "/app",
            user: "node",
          },
        ],
        placementConstraints: [
          {
            type: "memberOf",
            expression: "attribute:ecs.instance-type =~ t3.*",
          },
        ],
        tags: [
          {
            key: "Environment",
            value: "development",
          },
          {
            key: "Application",
            value: "web-app",
          },
        ],
        pidMode: "task",
        ipcMode: "task",
        ephemeralStorage: {
          sizeInGiB: 20,
        },
        runtimePlatform: {
          cpuArchitecture: "X86_64",
          operatingSystemFamily: "LINUX",
        },
      };

      // Target task definition with same structure but all different values
      const targetTaskDefinition: RegisterTaskDefinitionCommandInput = {
        family: "web-app-v2",
        taskRoleArn: "arn:aws:iam::123456789012:role/web-task-role-v2",
        executionRoleArn:
          "arn:aws:iam::123456789012:role/web-execution-role-v2",
        networkMode: "bridge",
        requiresCompatibilities: ["EC2"],
        cpu: "512",
        memory: "1024",
        volumes: [
          {
            name: "app-volume",
            host: {
              sourcePath: "/app/data-v2",
            },
          },
        ],
        containerDefinitions: [
          {
            name: "web-container",
            image: "nginx:1.21",
            cpu: 256,
            memory: 512,
            essential: false,
            portMappings: [
              {
                containerPort: 80,
                hostPort: 9090,
                protocol: "udp",
              },
            ],
            environment: [
              {
                name: "NODE_ENV",
                value: "production",
              },
              {
                name: "PORT",
                value: "8080",
              },
            ],
            secrets: [
              {
                name: "DATABASE_URL",
                valueFrom:
                  "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod-db-url",
              },
            ],
            mountPoints: [
              {
                sourceVolume: "app-volume",
                containerPath: "/app/data-v2",
                readOnly: true,
              },
            ],
            logConfiguration: {
              logDriver: "syslog",
              options: {
                "awslogs-group": "/prod/web-app",
                "awslogs-region": "us-west-2",
                "awslogs-stream-prefix": "prod",
              },
            },
            healthCheck: {
              command: [
                "CMD-SHELL",
                "curl -f http://localhost:8080/healthz || exit 1",
              ],
              interval: 60,
              timeout: 10,
              retries: 5,
              startPeriod: 120,
            },
            ulimits: [
              {
                name: "nofile",
                softLimit: 2048,
                hardLimit: 4096,
              },
            ],
            workingDirectory: "/app/v2",
            user: "www-data",
          },
        ],
        placementConstraints: [
          {
            type: "memberOf",
            expression: "attribute:ecs.instance-type =~ m5.*",
          },
        ],
        tags: [
          {
            key: "Environment",
            value: "production",
          },
          {
            key: "Application",
            value: "web-app-v2",
          },
        ],
        pidMode: "host",
        ipcMode: "host",
        ephemeralStorage: {
          sizeInGiB: 40,
        },
        runtimePlatform: {
          cpuArchitecture: "ARM64",
          operatingSystemFamily: "WINDOWS_SERVER_2019_CORE",
        },
      };

      // Mock the service with current task definition
      const mockService = {
        taskDefinition:
          "arn:aws:ecs:us-east-1:123456789012:task-definition/web-app:1",
      };

      // Setup mocks
      mockGithub.getFileContent.mockResolvedValue(targetTaskDefinition);
      mockAws.createECSClient.mockResolvedValue({} as any);
      mockAws.describeServices.mockResolvedValue(mockService as any);
      mockAws.describeTaskDefinition.mockResolvedValue(currentTaskDefinition);

      // Execute diff
      const diffs = await deployment.diff(application);

      // Verify all diffs are Modified type (no Added or Removed)
      expect(diffs).toBeDefined();
      expect(diffs.length).toBeGreaterThan(0);

      // Check that all diffs are Modified type
      const modifiedDiffs = diffs.filter((d) => d.type === "Modified");
      const addedDiffs = diffs.filter((d) => d.type === "Added");
      const removedDiffs = diffs.filter((d) => d.type === "Removed");

      expect(modifiedDiffs.length).toBe(diffs.length); // All diffs should be Modified
      expect(addedDiffs.length).toBe(0); // No Added diffs
      expect(removedDiffs.length).toBe(0); // No Removed diffs

      // Check specific Modified diffs
      const familyDiff = diffs.find((d) => d.path === "family");
      expect(familyDiff).toEqual({
        path: "family",
        current: "web-app",
        target: "web-app-v2",
        type: "Modified",
      });

      const taskRoleArnDiff = diffs.find((d) => d.path === "taskRoleArn");
      expect(taskRoleArnDiff).toEqual({
        path: "taskRoleArn",
        current: "arn:aws:iam::123456789012:role/web-task-role",
        target: "arn:aws:iam::123456789012:role/web-task-role-v2",
        type: "Modified",
      });

      const networkModeDiff = diffs.find((d) => d.path === "networkMode");
      expect(networkModeDiff).toEqual({
        path: "networkMode",
        current: "awsvpc",
        target: "bridge",
        type: "Modified",
      });

      const cpuDiff = diffs.find((d) => d.path === "cpu");
      expect(cpuDiff).toEqual({
        path: "cpu",
        current: "256",
        target: "512",
        type: "Modified",
      });

      const memoryDiff = diffs.find((d) => d.path === "memory");
      expect(memoryDiff).toEqual({
        path: "memory",
        current: "512",
        target: "1024",
        type: "Modified",
      });

      // Check container-level modifications
      const containerImageDiff = diffs.find(
        (d) => d.path === "containerDefinitions.web-container.image"
      );
      expect(containerImageDiff).toEqual({
        path: "containerDefinitions.web-container.image",
        current: "nginx:1.20",
        target: "nginx:1.21",
        type: "Modified",
      });

      const containerCpuDiff = diffs.find(
        (d) => d.path === "containerDefinitions.web-container.cpu"
      );
      expect(containerCpuDiff).toEqual({
        path: "containerDefinitions.web-container.cpu",
        current: "128",
        target: "256",
        type: "Modified",
      });

      const containerEssentialDiff = diffs.find(
        (d) => d.path === "containerDefinitions.web-container.essential"
      );
      expect(containerEssentialDiff).toEqual({
        path: "containerDefinitions.web-container.essential",
        current: "true",
        target: "false",
        type: "Modified",
      });

      // Check environment variables modifications
      const nodeEnvDiff = diffs.find(
        (d) =>
          d.path === "containerDefinitions.web-container.environment.NODE_ENV"
      );
      expect(nodeEnvDiff).toEqual({
        path: "containerDefinitions.web-container.environment.NODE_ENV",
        current: "development",
        target: "production",
        type: "Modified",
      });

      const portEnvDiff = diffs.find(
        (d) => d.path === "containerDefinitions.web-container.environment.PORT"
      );
      expect(portEnvDiff).toEqual({
        path: "containerDefinitions.web-container.environment.PORT",
        current: "3000",
        target: "8080",
        type: "Modified",
      });

      // Check secrets modifications
      const secretDiff = diffs.find(
        (d) =>
          d.path === "containerDefinitions.web-container.secrets.DATABASE_URL"
      );
      expect(secretDiff).toEqual({
        path: "containerDefinitions.web-container.secrets.DATABASE_URL",
        current:
          "arn:aws:secretsmanager:us-east-1:123456789012:secret:dev-db-url",
        target:
          "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod-db-url",
        type: "Modified",
      });

      // Check port mapping modifications
      const hostPortDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.web-container.portMappings.80.hostPort"
      );
      expect(hostPortDiff).toEqual({
        path: "containerDefinitions.web-container.portMappings.80.hostPort",
        current: "8080",
        target: "9090",
        type: "Modified",
      });

      const protocolDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.web-container.portMappings.80.protocol"
      );
      expect(protocolDiff).toEqual({
        path: "containerDefinitions.web-container.portMappings.80.protocol",
        current: "tcp",
        target: "udp",
        type: "Modified",
      });

      // Check mount points modifications
      const mountPathDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.web-container.mountPoints.app-volume.containerPath"
      );
      expect(mountPathDiff).toEqual({
        path: "containerDefinitions.web-container.mountPoints.app-volume.containerPath",
        current: "/app/data",
        target: "/app/data-v2",
        type: "Modified",
      });

      const readOnlyDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.web-container.mountPoints.app-volume.readOnly"
      );
      expect(readOnlyDiff).toEqual({
        path: "containerDefinitions.web-container.mountPoints.app-volume.readOnly",
        current: "false",
        target: "true",
        type: "Modified",
      });

      // Check volume modifications
      const volumeSourcePathDiff = diffs.find(
        (d) => d.path === "volumes.app-volume.host.sourcePath"
      );
      expect(volumeSourcePathDiff).toEqual({
        path: "volumes.app-volume.host.sourcePath",
        current: "/app/data",
        target: "/app/data-v2",
        type: "Modified",
      });

      // Check log configuration modifications
      const logDriverDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.web-container.logConfiguration.logDriver"
      );
      expect(logDriverDiff).toEqual({
        path: "containerDefinitions.web-container.logConfiguration.logDriver",
        current: "awslogs",
        target: "syslog",
        type: "Modified",
      });

      const logGroupDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.web-container.logConfiguration.options.awslogs-group"
      );
      expect(logGroupDiff).toEqual({
        path: "containerDefinitions.web-container.logConfiguration.options.awslogs-group",
        current: "/dev/web-app",
        target: "/prod/web-app",
        type: "Modified",
      });

      const logRegionDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.web-container.logConfiguration.options.awslogs-region"
      );
      expect(logRegionDiff).toEqual({
        path: "containerDefinitions.web-container.logConfiguration.options.awslogs-region",
        current: "us-east-1",
        target: "us-west-2",
        type: "Modified",
      });

      const logPrefixDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.web-container.logConfiguration.options.awslogs-stream-prefix"
      );
      expect(logPrefixDiff).toEqual({
        path: "containerDefinitions.web-container.logConfiguration.options.awslogs-stream-prefix",
        current: "dev",
        target: "prod",
        type: "Modified",
      });

      // Check health check modifications
      const healthCheckCommandDiff = diffs.find(
        (d) =>
          d.path === "containerDefinitions.web-container.healthCheck.command"
      );
      expect(healthCheckCommandDiff).toEqual({
        path: "containerDefinitions.web-container.healthCheck.command",
        current: "CMD-SHELL,curl -f http://localhost:3000/health || exit 1",
        target: "CMD-SHELL,curl -f http://localhost:8080/healthz || exit 1",
        type: "Modified",
      });

      const healthCheckIntervalDiff = diffs.find(
        (d) =>
          d.path === "containerDefinitions.web-container.healthCheck.interval"
      );
      expect(healthCheckIntervalDiff).toEqual({
        path: "containerDefinitions.web-container.healthCheck.interval",
        current: "30",
        target: "60",
        type: "Modified",
      });

      // Check ulimits modifications
      const ulimitSoftDiff = diffs.find(
        (d) =>
          d.path ===
          "containerDefinitions.web-container.ulimits.nofile.softLimit"
      );
      expect(ulimitSoftDiff).toEqual({
        path: "containerDefinitions.web-container.ulimits.nofile.softLimit",
        current: "1024",
        target: "2048",
        type: "Modified",
      });

      // Check placement constraints modifications
      const placementExpressionDiff = diffs.find(
        (d) => d.path === "placementConstraints.memberOf.expression"
      );
      expect(placementExpressionDiff).toEqual({
        path: "placementConstraints.memberOf.expression",
        current: "attribute:ecs.instance-type =~ t3.*",
        target: "attribute:ecs.instance-type =~ m5.*",
        type: "Modified",
      });

      // Check tags modifications - using the actual path structure from the logs
      const envTagDiff = diffs.find((d) => d.path === "tags.Environment");
      expect(envTagDiff).toEqual({
        path: "tags.Environment",
        current: "development",
        target: "production",
        type: "Modified",
      });

      const appTagDiff = diffs.find((d) => d.path === "tags.Application");
      expect(appTagDiff).toEqual({
        path: "tags.Application",
        current: "web-app",
        target: "web-app-v2",
        type: "Modified",
      });

      // Check process modes modifications
      const pidModeDiff = diffs.find((d) => d.path === "pidMode");
      expect(pidModeDiff).toEqual({
        path: "pidMode",
        current: "task",
        target: "host",
        type: "Modified",
      });

      const ipcModeDiff = diffs.find((d) => d.path === "ipcMode");
      expect(ipcModeDiff).toEqual({
        path: "ipcMode",
        current: "task",
        target: "host",
        type: "Modified",
      });

      // Check ephemeral storage modifications
      const ephemeralStorageDiff = diffs.find(
        (d) => d.path === "ephemeralStorage.sizeInGiB"
      );
      expect(ephemeralStorageDiff).toEqual({
        path: "ephemeralStorage.sizeInGiB",
        current: "20",
        target: "40",
        type: "Modified",
      });

      // Check runtime platform modifications
      const cpuArchDiff = diffs.find(
        (d) => d.path === "runtimePlatform.cpuArchitecture"
      );
      expect(cpuArchDiff).toEqual({
        path: "runtimePlatform.cpuArchitecture",
        current: "X86_64",
        target: "ARM64",
        type: "Modified",
      });

      const osFamilyDiff = diffs.find(
        (d) => d.path === "runtimePlatform.operatingSystemFamily"
      );
      expect(osFamilyDiff).toEqual({
        path: "runtimePlatform.operatingSystemFamily",
        current: "LINUX",
        target: "WINDOWS_SERVER_2019_CORE",
        type: "Modified",
      });

      // Check working directory and user modifications
      const workingDirDiff = diffs.find(
        (d) => d.path === "containerDefinitions.web-container.workingDirectory"
      );
      expect(workingDirDiff).toEqual({
        path: "containerDefinitions.web-container.workingDirectory",
        current: "/app",
        target: "/app/v2",
        type: "Modified",
      });

      const userDiff = diffs.find(
        (d) => d.path === "containerDefinitions.web-container.user"
      );
      expect(userDiff).toEqual({
        path: "containerDefinitions.web-container.user",
        current: "node",
        target: "www-data",
        type: "Modified",
      });

      // Verify mocks were called correctly
      expect(mockGithub.getFileContent).toHaveBeenCalledWith(application);
      expect(mockAws.createECSClient).toHaveBeenCalledWith(
        application.awsConfig
      );
      expect(mockAws.describeServices).toHaveBeenCalledWith(
        expect.anything(),
        application.ecsConfig
      );
      expect(mockAws.describeTaskDefinition).toHaveBeenCalledWith(
        expect.anything(),
        "arn:aws:ecs:us-east-1:123456789012:task-definition/web-app:1"
      );
    });
  });
});
