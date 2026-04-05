export type ApplicationSyncStatus = "InSync" | "OutOfSync" | "Error";

export type ApplicationStatus =
  | "Loading"
  | "Error"
  | "Deploying"
  | "Failed"
  | "OutOfSync"
  | "InSync";

export interface ApplicationDomain {
  name: string;
  status: ApplicationStatus;
  reason?: string;
  sync: {
    status: ApplicationSyncStatus;
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

export function deriveApplicationStatus(application: ApplicationDomain): {
  status: ApplicationStatus;
  reason?: string;
} {
  if (application.sync.status === "Error") {
    return {
      status: "Error",
      reason:
        application.reason || "Failed to compare ECS and GitHub configuration.",
    };
  }

  if (!application.service) {
    return {
      status: "Error",
      reason: application.reason || "Failed to fetch ECS service state.",
    };
  }

  if (application.service.status !== "ACTIVE") {
    return {
      status: "Error",
      reason: `ECS service is ${application.service.status}. ecscd requires an ACTIVE service.`,
    };
  }

  const currentDeployment =
    application.service.deployments.find(
      (deployment) => deployment.status === "PRIMARY"
    ) || application.service.deployments[0];

  if (currentDeployment?.rolloutState === "IN_PROGRESS") {
    return {
      status: "Deploying",
      reason: currentDeployment.rolloutStateReason || "Deployment is in progress.",
    };
  }

  if (currentDeployment?.rolloutState === "FAILED") {
    return {
      status: "Failed",
      reason:
        currentDeployment.rolloutStateReason || "The last deployment failed.",
    };
  }

  if (application.sync.status === "OutOfSync") {
    return {
      status: "OutOfSync",
    };
  }

  return {
    status: "InSync",
  };
}

export function applyApplicationStatus(
  application: ApplicationDomain
): ApplicationDomain {
  const { status, reason } = deriveApplicationStatus(application);
  application.status = status;
  application.reason = reason;
  return application;
}
