export type ApplicationSyncStatus = "InSync" | "OutOfSync";
export type ResourceStatus = "Loading" | "Success" | "Error";
export type EcsServiceStatus = "ACTIVE" | "DRAINING" | "INACTIVE";
export type EcsDeploymentStatus = "PRIMARY" | "ACTIVE" | "INACTIVE";
export type EcsRolloutState = "COMPLETED" | "FAILED" | "IN_PROGRESS";

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

export interface GitTaskDefinitionSource {
  repo: string;
  branch: string;
  path: string;
}

export interface EcsServiceTarget {
  cluster: string;
  service: string;
}

export interface AwsAccessProfile {
  region?: string;
  roleArn?: string;
  externalId: string;
}

export interface ApplicationDomain {
  name: string;
  gitConfig: GitTaskDefinitionSource;
  ecsConfig: EcsServiceTarget;
  awsConfig: AwsAccessProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface ObservedApplicationDomain extends ApplicationDomain {
  sync: ResourceResult<ApplicationSyncDomain>;
  diff: ResourceResult<DiffDomain[]>;
  service: ResourceResult<ServiceDomain>;
  observedAt: Date;
}

export interface CreateApplicationInput {
  name: string;
  gitConfig: GitTaskDefinitionSource;
  ecsConfig: EcsServiceTarget;
  awsConfig: AwsAccessProfile;
  now: Date;
}

export interface UpdateApplicationSettingsInput {
  gitConfig: GitTaskDefinitionSource;
  ecsConfig: EcsServiceTarget;
  awsConfig: AwsAccessProfile;
  now: Date;
}

export type ResourceResult<T> =
  | { status: "Loading" }
  | { status: "Success"; value: T }
  | { status: "Error"; reason: string };

export function createLoadingResource<T>(): ResourceResult<T> {
  return { status: "Loading" };
}

export function create(input: CreateApplicationInput): ApplicationDomain {
  return {
    name: input.name,
    gitConfig: input.gitConfig,
    ecsConfig: input.ecsConfig,
    awsConfig: input.awsConfig,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function updateSettings(
  application: ApplicationDomain,
  input: UpdateApplicationSettingsInput,
): ApplicationDomain {
  return {
    ...application,
    gitConfig: input.gitConfig,
    ecsConfig: input.ecsConfig,
    awsConfig: input.awsConfig,
    updatedAt: input.now,
  };
}

export function createLoadingObserved(
  application: ApplicationDomain,
  observedAt: Date = new Date(),
): ObservedApplicationDomain {
  return {
    ...application,
    sync: createLoadingResource(),
    diff: createLoadingResource(),
    service: createLoadingResource(),
    observedAt,
  };
}

export function isObservedApplication(
  application: ApplicationDomain | ObservedApplicationDomain,
): application is ObservedApplicationDomain {
  return "sync" in application && "diff" in application && "service" in application;
}

export interface ApplicationSyncDomain {
  status: ApplicationSyncStatus;
  lastSyncedAt?: Date;
}

export interface ServiceDomain {
  status: EcsServiceStatus;
  desiredCount: number;
  runningCount: number;
  taskDefinition: string;
  deployments: {
    status: EcsDeploymentStatus;
    createdAt: Date;
    updatedAt: Date;
    rolloutState: EcsRolloutState;
    rolloutStateReason: string;
  }[];
}

export interface DiffDomain {
  path: string;
  current?: string;
  target?: string;
  type: "Added" | "Removed" | "Modified";
}

export function getApplicationCurrentDeployment(
  application: ApplicationDomain | ObservedApplicationDomain,
): ServiceDomain["deployments"][number] | null {
  if (!isObservedApplication(application)) {
    return null;
  }

  if (application.service.status !== "Success") {
    return null;
  }

  const service = application.service.value;
  return (
    service.deployments.find((deployment) => deployment.status === "PRIMARY") ||
    service.deployments[0] ||
    null
  );
}

export function getApplicationStatus(
  application: ApplicationDomain | ObservedApplicationDomain,
): ApplicationStatusReason {
  if (!isObservedApplication(application)) {
    return {
      status: "Loading",
      reason: "Loading ECS service state...",
    };
  }

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

  // FIXME(review): この Error 判定が下の rolloutState IN_PROGRESS 判定より先に
  // 評価されるため、デプロイ中に GitHub 側の一時エラー(レートリミット等)が
  // 1 回起きるだけで状態が "Deploying" → "Error" に反転し、UI の Deploying 限定
  // ポーリングが恒久停止する(application-dashboard.tsx の polling effect 参照)。
  // 修正例: currentDeployment の IN_PROGRESS / FAILED 判定をこのブロックの前に移動する。
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

  const currentDeployment = getApplicationCurrentDeployment(application);

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

export function getApplicationDiffs(
  application: ApplicationDomain | ObservedApplicationDomain,
): DiffDomain[] {
  if (!isObservedApplication(application)) {
    return [];
  }

  return application.diff.status === "Success" ? application.diff.value : [];
}

export function getApplicationDiffSummary(
  application: ApplicationDomain | ObservedApplicationDomain,
): string {
  return `${getApplicationDiffs(application).length} changes`;
}
