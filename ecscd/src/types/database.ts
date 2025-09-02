export interface DatabaseApplication {
  id: string;
  name: string;
  gitRepository: {
    owner: string;
    repo: string;
    branch?: string;
    path?: string;
    token?: string;
  };
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
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseDeployment {
  id: string;
  applicationId: string;
  status: 'InProgress' | 'Successful' | 'Failed' | 'Stopped';
  message: string;
  startedAt: Date;
  finishedAt?: Date;
  progress: {
    current: number;
    total: number;
    message: string;
  };
  taskDefinitionArn?: string;
  revision?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseDeploymentEvent {
  id: string;
  deploymentId: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'warning' | 'error';
  createdAt: Date;
}

export interface DatabaseSyncStatus {
  id: string;
  applicationId: string;
  status: 'Synced' | 'OutOfSync' | 'Unknown' | 'Error';
  revision: string;
  lastSyncedAt?: Date;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseApplicationStatus {
  id: string;
  applicationId: string;
  health: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
  operationState?: {
    phase: 'Running' | 'Error' | 'Failed' | 'Succeeded' | 'Terminating';
    message?: string;
    startedAt?: Date;
    finishedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseConfig {
  type: 'dynamodb' | 'sqlite';
  region?: string;
  tableName?: string;
  filePath?: string;
}