import { ApplicationDomain, ApplicationStatus } from "@/lib/domain/application";

export function buildDashboardHref(
  appName?: string | null,
  filterPattern?: string,
  statuses: ApplicationStatus[] = []
) {
  const params = new URLSearchParams();
  if (filterPattern) {
    params.set("filter", filterPattern);
  }
  if (statuses.length > 0) {
    params.set("status", statuses.join(","));
  }

  const query = params.toString();
  const pathname = appName ? `/apps/${encodeURIComponent(appName)}` : "/";
  return query ? `${pathname}?${query}` : pathname;
}

export function getEcsDeploymentsConsoleUrl(application: ApplicationDomain) {
  const region = application.awsConfig.region || "us-east-1";
  const cluster = application.ecsConfig.cluster;
  const service = application.ecsConfig.service;
  return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${encodeURIComponent(
    cluster
  )}/services/${encodeURIComponent(service)}/deployments?region=${region}`;
}

export function getEcsClusterConsoleUrl(application: ApplicationDomain) {
  const region = application.awsConfig.region || "us-east-1";
  const cluster = application.ecsConfig.cluster;
  return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${encodeURIComponent(
    cluster
  )}?region=${region}`;
}

export function getEcsServiceConsoleUrl(application: ApplicationDomain) {
  const region = application.awsConfig.region || "us-east-1";
  const cluster = application.ecsConfig.cluster;
  const service = application.ecsConfig.service;
  return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${encodeURIComponent(
    cluster
  )}/services/${encodeURIComponent(service)}?region=${region}`;
}

function getNormalizedGitHubRepoUrl(repo: string) {
  const url = new URL(repo);

  // To prevent XSS, forbid non-http(s) URLs like `javascript:`.
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Git repository URL must use http or https.");
  }

  return url.toString();
}

function getGitBranchUrl(application: ApplicationDomain) {
  const repo = getNormalizedGitHubRepoUrl(application.gitConfig.repo);
  return `${repo}/tree/${encodeURIComponent(application.gitConfig.branch)}`;
}

function getGitTaskDefinitionUrl(application: ApplicationDomain) {
  const repo = getNormalizedGitHubRepoUrl(application.gitConfig.repo);
  const branch = encodeURIComponent(application.gitConfig.branch);
  const path = application.gitConfig.path
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${repo}/blob/${branch}/${path}`;
}

export function getGitLinks(application: ApplicationDomain) {
  try {
    return {
      branchUrl: getGitBranchUrl(application),
      taskDefinitionUrl: getGitTaskDefinitionUrl(application),
    };
  } catch {
    return null;
  }
}
