export interface ApplicationDomain {
  name: string;
  sync: {
    status: "Synced" | "OutOfSync" | "Error";
    lastSyncedAt?: Date;
  };
  gitConfig: {
    repo: string;
    branch: string;
    path: string;
  };
  ecsConfig: {
    cluster: string;
    service: string;
  };
  awsConfig: {
    region?: string;
    roleArn?: string;
    externalId: string;
  };
  service?: ServiceDomain;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceDomain {
  status: string;
  desiredCount: number;
  runningCount: number;
  taskDefinition: string;
  deployments: {
    status: string;
    createdAt: Date;
    updatedAt: Date;
    rolloutState: "COMPLETED" | "FAILED" | "IN_PROGRESS";
    rolloutStateReason: string;
  }[];
}

export interface DiffDomain {
  path: string;
  current?: string;
  target?: string;
  type: "Added" | "Removed" | "Modified";
}
