export type ApplicationSyncStatus = "InSync" | "OutOfSync";
export type ResourceStatus = "Loading" | "Success" | "Error";

export type ApplicationStatus =
  | "Loading"
  | "Error"
  | "Deploying"
  | "Failed"
  | "OutOfSync"
  | "InSync";

export type ApplicationStatusReason =
  | { status: "Loading"; reason: string }
  | { status: "Error"; reason: string }
  | { status: "Deploying"; reason: string }
  | { status: "Failed"; reason: string }
  | { status: "OutOfSync" }
  | { status: "InSync" };

export interface ApplicationDomain {
  name: string;
  sync: ResourceResult<ApplicationSyncDomain>;
  diff: ResourceResult<DiffDomain[]>;
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
  service: ResourceResult<ServiceDomain>;
  createdAt: Date;
  updatedAt: Date;
}

export type ResourceResult<T> =
  | { status: "Loading" }
  | { status: "Success"; value: T }
  | { status: "Error"; reason: string };

export function createLoadingResource<T>(): ResourceResult<T> {
  return { status: "Loading" };
}

export interface ApplicationSyncDomain {
  status: ApplicationSyncStatus;
  lastSyncedAt?: Date;
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

export function getApplicationStatus(
  application: ApplicationDomain,
): ApplicationStatusReason {
  if (application.service.status === "Loading") {
    return {
      status: "Loading",
      reason: "Loading ECS service state...",
    };
  }

  if (application.service.status === "Error") {
    return {
      status: "Error",
      reason:
        application.service.reason || "Failed to fetch ECS service state.",
    };
  }

  const service = application.service.value;

  if (application.sync.status === "Error") {
    return {
      status: "Error",
      reason:
        application.sync.reason ||
        (application.diff.status === "Error"
          ? application.diff.reason
          : undefined) ||
        "Failed to compare ECS and GitHub configuration.",
    };
  }

  if (!service) {
    return {
      status: "Error",
      reason: "Failed to fetch ECS service state.",
    };
  }

  if (service.status !== "ACTIVE") {
    return {
      status: "Error",
      reason: `ECS service is ${service.status}. ecscd requires an ACTIVE service.`,
    };
  }

  const currentDeployment =
    service.deployments.find((deployment) => deployment.status === "PRIMARY") ||
    service.deployments[0];

  if (currentDeployment?.rolloutState === "IN_PROGRESS") {
    return {
      status: "Deploying",
      reason:
        currentDeployment.rolloutStateReason || "Deployment is in progress.",
    };
  }

  if (currentDeployment?.rolloutState === "FAILED") {
    return {
      status: "Failed",
      reason:
        currentDeployment.rolloutStateReason || "The last deployment failed.",
    };
  }

  if (application.diff.status === "Loading") {
    return {
      status: "Loading",
      reason: "Loading configuration diff...",
    };
  }

  if (application.diff.status === "Error") {
    return {
      status: "Error",
      reason:
        application.diff.reason ||
        "Failed to compare ECS and GitHub configuration.",
    };
  }

  if (application.sync.status === "Loading") {
    return {
      status: "Loading",
      reason: "Loading sync status...",
    };
  }

  const sync = application.sync.value;

  if (!sync) {
    return {
      status: "Error",
      reason: "Failed to determine sync status.",
    };
  }

  if (sync.status === "OutOfSync") {
    return {
      status: "OutOfSync",
    };
  }

  return {
    status: "InSync",
  };
}
