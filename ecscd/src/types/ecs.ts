export interface ECSTaskDefinition {
  taskDefinitionArn: string;
  family: string;
  revision: number;
  status: string;
  requiresAttributes?: Array<{
    name: string;
    value?: string;
  }>;
  placementConstraints?: Array<{
    type: string;
    expression?: string;
  }>;
  compatibilities?: string[];
  requiresCompatibilities?: string[];
  cpu?: string;
  memory?: string;
  networkMode?: string;
  executionRoleArn?: string;
  taskRoleArn?: string;
  containerDefinitions: ECSContainerDefinition[];
  volumes?: Array<{
    name: string;
    host?: {
      sourcePath?: string;
    };
    dockerVolumeConfiguration?: {
      scope?: string;
      autoprovision?: boolean;
      driver?: string;
      driverOpts?: Record<string, string>;
      labels?: Record<string, string>;
    };
    efsVolumeConfiguration?: {
      fileSystemId: string;
      rootDirectory?: string;
      transitEncryption?: string;
      transitEncryptionPort?: number;
      authorizationConfig?: {
        accessPointId?: string;
        iam?: string;
      };
    };
  }>;
  registeredAt?: Date;
  registeredBy?: string;
}

export interface ECSContainerDefinition {
  name: string;
  image: string;
  repositoryCredentials?: {
    credentialsParameter: string;
  };
  cpu?: number;
  memory?: number;
  memoryReservation?: number;
  links?: string[];
  portMappings?: Array<{
    containerPort: number;
    hostPort?: number;
    protocol?: string;
  }>;
  essential?: boolean;
  entryPoint?: string[];
  command?: string[];
  environment?: Array<{
    name: string;
    value: string;
  }>;
  environmentFiles?: Array<{
    value: string;
    type: string;
  }>;
  mountPoints?: Array<{
    sourceVolume: string;
    containerPath: string;
    readOnly?: boolean;
  }>;
  volumesFrom?: Array<{
    sourceContainer: string;
    readOnly?: boolean;
  }>;
  linuxParameters?: {
    capabilities?: {
      add?: string[];
      drop?: string[];
    };
    devices?: Array<{
      hostPath: string;
      containerPath?: string;
      permissions?: string[];
    }>;
    initProcessEnabled?: boolean;
    sharedMemorySize?: number;
    tmpfs?: Array<{
      containerPath: string;
      size: number;
      mountOptions?: string[];
    }>;
    maxSwap?: number;
    swappiness?: number;
  };
  secrets?: Array<{
    name: string;
    valueFrom: string;
  }>;
  dependsOn?: Array<{
    containerName: string;
    condition: string;
  }>;
  startTimeout?: number;
  stopTimeout?: number;
  hostname?: string;
  user?: string;
  workingDirectory?: string;
  disableNetworking?: boolean;
  privileged?: boolean;
  readonlyRootFilesystem?: boolean;
  dnsServers?: string[];
  dnsSearchDomains?: string[];
  extraHosts?: Array<{
    hostname: string;
    ipAddress: string;
  }>;
  dockerSecurityOptions?: string[];
  interactive?: boolean;
  pseudoTerminal?: boolean;
  dockerLabels?: Record<string, string>;
  ulimits?: Array<{
    name: string;
    softLimit: number;
    hardLimit: number;
  }>;
  logConfiguration?: {
    logDriver: string;
    options?: Record<string, string>;
    secretOptions?: Array<{
      name: string;
      valueFrom: string;
    }>;
  };
  healthCheck?: {
    command: string[];
    interval?: number;
    timeout?: number;
    retries?: number;
    startPeriod?: number;
  };
  systemControls?: Array<{
    name: string;
    value: string;
  }>;
  resourceRequirements?: Array<{
    value: string;
    type: string;
  }>;
  firelensConfiguration?: {
    type: string;
    options?: Record<string, string>;
  };
}

export interface ECSService {
  serviceName: string;
  serviceArn: string;
  clusterArn: string;
  taskDefinition: string;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  status: string;
  deployments: Array<{
    id: string;
    status: string;
    taskDefinition: string;
    desiredCount: number;
    runningCount: number;
    pendingCount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  events?: Array<{
    id: string;
    createdAt: Date;
    message: string;
  }>;
  launchType?: string;
  platformVersion?: string;
  capacityProviderStrategy?: Array<{
    capacityProvider: string;
    weight?: number;
    base?: number;
  }>;
  networkConfiguration?: {
    awsvpcConfiguration?: {
      subnets: string[];
      securityGroups?: string[];
      assignPublicIp?: string;
    };
  };
  loadBalancers?: Array<{
    targetGroupArn?: string;
    loadBalancerName?: string;
    containerName: string;
    containerPort: number;
  }>;
  serviceRegistries?: Array<{
    registryArn?: string;
    port?: number;
    containerName?: string;
    containerPort?: number;
  }>;
  placementConstraints?: Array<{
    type: string;
    expression?: string;
  }>;
  placementStrategy?: Array<{
    type: string;
    field?: string;
  }>;
  deploymentController?: {
    type: string;
  };
  tags?: Array<{
    key: string;
    value: string;
  }>;
  createdAt?: Date;
  createdBy?: string;
  enableECSManagedTags?: boolean;
  propagateTags?: string;
  enableExecuteCommand?: boolean;
}

export interface ECSCluster {
  clusterName: string;
  clusterArn: string;
  status: string;
  runningTasksCount: number;
  pendingTasksCount: number;
  activeServicesCount: number;
  registeredContainerInstancesCount: number;
  statistics?: Array<{
    name: string;
    value: string;
  }>;
  tags?: Array<{
    key: string;
    value: string;
  }>;
  settings?: Array<{
    name: string;
    value: string;
  }>;
  capacityProviders?: string[];
  defaultCapacityProviderStrategy?: Array<{
    capacityProvider: string;
    weight?: number;
    base?: number;
  }>;
  attachments?: Array<{
    id: string;
    type: string;
    status: string;
    details?: Array<{
      name: string;
      value: string;
    }>;
  }>;
  attachmentsStatus?: string;
}

export interface GitHubRepository {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  token?: string;
}

export interface ApplicationConfig {
  name: string;
  gitRepository: GitHubRepository;
  ecsCluster: string;
  ecsService: string;
  taskDefinitionPath: string;
  autoSync?: boolean;
  syncPolicy?: {
    automated?: boolean;
    selfHeal?: boolean;
    prune?: boolean;
  };
  awsConfig?: {
    region?: string;
    roleArn?: string;
    externalId?: string;
    sessionName?: string;
  };
}

export interface SyncStatus {
  status: 'Synced' | 'OutOfSync' | 'Unknown' | 'Error';
  revision: string;
  lastSyncedAt?: Date;
  message?: string;
  deploymentStatus?: {
    id: string;
    status: 'PRIMARY' | 'ACTIVE' | 'DRAINING' | 'INACTIVE' | 'PENDING' | 'RUNNING' | 'STOPPED';
    runningCount: number;
    desiredCount: number;
    pendingCount: number;
    rolloutState?: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
    rolloutStateReason?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface ApplicationStatus {
  health: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
  sync: SyncStatus;
  operationState?: {
    phase: 'Running' | 'Error' | 'Failed' | 'Succeeded' | 'Terminating';
    message?: string;
    startedAt?: Date;
    finishedAt?: Date;
  };
}

export interface Application {
  metadata: {
    name: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: ApplicationConfig;
  status?: ApplicationStatus;
}

export interface TaskDefinitionDiff {
  path: string;
  type: 'added' | 'removed' | 'modified';
  currentValue?: any;
  targetValue?: any;
  message?: string;
}