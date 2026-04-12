"use client";

import {
  ApplicationStatusBadge,
  ApplicationStatusDot,
} from "@/components/application-status-indicator";
import { DashboardDetailPane } from "@/components/dashboard-detail-pane";
import { DashboardEditApplicationButton } from "@/components/dashboard-edit-application-button";
import { DashboardNewApplicationButton } from "@/components/dashboard-new-application-button";
import { DashboardSidebarPane } from "@/components/dashboard-sidebar-pane";
import { DashboardSyncActions } from "@/components/dashboard-sync-actions";
import { DiffViewer } from "@/components/diff-viewer";
import { FilterSelector } from "@/components/filter-selector";
import {
  ApplicationDomain,
  ApplicationStatus,
  getApplicationStatus,
} from "@/lib/domain/application";
import { FilterDomain } from "@/lib/domain/filter";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ApplicationDashboardProps = {
  applications: ApplicationDomain[];
  filters: FilterDomain[];
};

type CacheEntry = {
  data?: ApplicationDomain;
  promise?: Promise<void>;
};

const applicationCache = new Map<string, CacheEntry>();
const ALL_APPLICATION_STATUSES: ApplicationStatus[] = [
  "Loading",
  "Error",
  "OutOfSync",
  "Deploying",
  "Failed",
  "InSync",
];

function createApplicationErrorState(
  config: ApplicationDomain,
  reason: string
): ApplicationDomain {
  return {
    ...config,
    sync: {
      status: "Error",
      reason,
    },
    service: {
      status: "Error",
      reason,
    },
    diff: {
      status: "Error",
      reason,
    },
  };
}

function getCachedApplication(config: ApplicationDomain): ApplicationDomain | null {
  const entry = applicationCache.get(config.name);
  if (!entry?.data) {
    return null;
  }

  return entry.data;
}

function buildDashboardHref(
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

function formatLastSyncTime(date?: Date) {
  if (!date) return "Never";

  const now = new Date();
  const dateObj = date instanceof Date ? date : new Date(date);
  const diff = now.getTime() - dateObj.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function getEcsDeploymentsConsoleUrl(application: ApplicationDomain) {
  const region = application.awsConfig.region || "us-east-1";
  const cluster = application.ecsConfig.cluster;
  const service = application.ecsConfig.service;
  return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${encodeURIComponent(
    cluster
  )}/services/${encodeURIComponent(service)}/deployments?region=${region}`;
}

function getEcsClusterConsoleUrl(application: ApplicationDomain) {
  const region = application.awsConfig.region || "us-east-1";
  const cluster = application.ecsConfig.cluster;
  return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${encodeURIComponent(
    cluster
  )}?region=${region}`;
}

function getEcsServiceConsoleUrl(application: ApplicationDomain) {
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

function getGitLinks(application: ApplicationDomain) {
  try {
    return {
      branchUrl: getGitBranchUrl(application),
      taskDefinitionUrl: getGitTaskDefinitionUrl(application),
    };
  } catch {
    return null;
  }
}

export function ApplicationDashboard({
  applications,
  filters,
}: ApplicationDashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cacheVersion, setCacheVersion] = useState(0);

  const selectedAppName = useMemo(() => {
    const match = pathname.match(/^\/apps\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);
  const filterPattern = searchParams.get("filter") || "";
  const selectedStatuses = useMemo(
    () =>
      (searchParams.get("status") || "")
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is ApplicationStatus =>
          ["Loading", "Error", "Deploying", "Failed", "OutOfSync", "InSync"].includes(
            value
          )
        ),
    [searchParams]
  );
  const normalizedFilter = filterPattern.trim().toLowerCase();

  const nameFilteredApplications = useMemo(() => {
    if (!normalizedFilter) {
      return applications;
    }

    return applications.filter((application) =>
      application.name.toLowerCase().includes(normalizedFilter)
    );
  }, [applications, normalizedFilter]);

  const statusOptions = useMemo(() => {
    const total = nameFilteredApplications.length;
    const counts = new Map<ApplicationStatus, number>();

    for (const application of nameFilteredApplications) {
      const status =
        getApplicationStatus(getCachedApplication(application) || application).status;
      counts.set(status, (counts.get(status) || 0) + 1);
    }

    return ALL_APPLICATION_STATUSES.map((status) => ({
      status,
      count: counts.get(status) || 0,
      total,
    }));
  }, [cacheVersion, nameFilteredApplications]);

  const visibleApplications = useMemo(() => {
    if (selectedStatuses.length === 0) {
      return nameFilteredApplications;
    }

    const selectedStatusSet = new Set(selectedStatuses);
    return nameFilteredApplications.filter((application) => {
      const status =
        getApplicationStatus(getCachedApplication(application) || application).status;
      return selectedStatusSet.has(status);
    });
  }, [cacheVersion, nameFilteredApplications, selectedStatuses]);

  const selectedApplicationConfig = selectedAppName
    ? applications.find((application) => application.name === selectedAppName) ||
      null
    : null;
  const selectedApplication = selectedApplicationConfig
    ? getCachedApplication(selectedApplicationConfig)
    : null;
  const isDetailRoute = selectedAppName !== null;
  const gitLinks = selectedApplicationConfig
    ? getGitLinks(selectedApplicationConfig)
    : null;

  const loadApplication = useCallback((config: ApplicationDomain) => {
    const existing = applicationCache.get(config.name);
    if (existing?.data || existing?.promise) {
      return;
    }

    const entry = existing || {};
    entry.promise = (async () => {
      try {
        const response = await fetch(`/api/apps/${encodeURIComponent(config.name)}`);
        if (!response.ok) {
          throw new Error("Failed to fetch application");
        }

        entry.data = (await response.json()) as ApplicationDomain;
      } catch (error) {
        const reason =
          error instanceof Error
            ? error.message
            : "Failed to load latest application state.";
        entry.data = createApplicationErrorState(config, reason);
      } finally {
        entry.promise = undefined;
        applicationCache.set(config.name, entry);
        setCacheVersion((version) => version + 1);
      }
    })();

    applicationCache.set(config.name, entry);
  }, []);

  useEffect(() => {
    for (const application of nameFilteredApplications) {
      loadApplication(application);
    }

    if (
      selectedApplicationConfig &&
      !nameFilteredApplications.some(
        (application) => application.name === selectedApplicationConfig.name
      )
    ) {
      loadApplication(selectedApplicationConfig);
    }
  }, [loadApplication, nameFilteredApplications, selectedApplicationConfig]);

  const handleApplicationChanged = useCallback(
    (name: string) => {
      applicationCache.delete(name);
      const config =
        applications.find((application) => application.name === name) || null;
      if (config) {
        loadApplication(config);
      }
      setCacheVersion((version) => version + 1);
      router.refresh();
    },
    [applications, loadApplication, router]
  );

  const handleApplicationDeleted = useCallback(
    (name: string) => {
      applicationCache.delete(name);
      setCacheVersion((version) => version + 1);
      router.refresh();
    },
    [router]
  );

  return (
    <div className="h-screen bg-gray-50 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
      <aside
        className={`bg-white flex flex-col min-h-0 relative ${
          isDetailRoute ? "hidden lg:flex" : "flex"
        }`}
      >
        <header className="h-16 shrink-0 px-4 sm:px-6 flex items-center relative">
          <div className="flex w-full items-center gap-4">
            <Link
              href={buildDashboardHref(null, filterPattern, selectedStatuses)}
              className="flex items-center gap-3"
            >
              <GitBranch className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">ecscd</h1>
            </Link>
          </div>
        </header>

        <DashboardSidebarPane
          filter={
            <FilterSelector
              initialFilter={filterPattern}
              initialFilters={filters}
              initialSelectedStatuses={selectedStatuses}
              statusOptions={statusOptions}
            />
          }
          list={
            visibleApplications.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">
                {applications.length === 0
                  ? "No applications configured yet"
                  : "No applications match the current filters"}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {visibleApplications.map((application) => {
                  const href = buildDashboardHref(
                    application.name,
                    filterPattern,
                    selectedStatuses
                  );
                  const cachedApplication = getCachedApplication(application);
                  const displayApplication = cachedApplication || application;

                  return (
                    <div
                      key={application.name}
                      className={`flex items-start gap-3 rounded-md px-3 py-2 transition-colors ${
                        selectedAppName === application.name
                          ? "bg-zinc-100"
                          : "bg-transparent hover:bg-zinc-100/70"
                      }`}
                    >
                      <Link href={href} className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <ApplicationStatusDot application={displayApplication} />
                          <div className="font-medium text-gray-900 truncate">
                            {application.name}
                          </div>
                        </div>
                        <div className="mt-0.5 pl-4 text-xs text-zinc-500 truncate">
                          {application.gitConfig.repo} @{application.gitConfig.branch}
                        </div>
                      </Link>
                      <DashboardEditApplicationButton
                        application={application}
                        onApplicationChanged={handleApplicationChanged}
                        onApplicationDeleted={handleApplicationDeleted}
                      />
                    </div>
                  );
                })}
                <DashboardNewApplicationButton />
              </div>
            )
          }
        />
      </aside>

      {!selectedApplicationConfig ? (
        <main
          className={`min-h-0 overflow-y-auto relative shadow-[-4px_0_14px_rgba(15,23,42,0.12)] ${
            isDetailRoute ? "block" : "hidden lg:flex"
          }`}
        >
          <div className="flex min-h-full items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
            <div className="max-w-md text-center">
              <div className="text-base font-medium text-gray-900">
                {isDetailRoute
                  ? "Application not found"
                  : "Select an application"}
              </div>
              <div className="mt-2 text-sm leading-6 text-gray-600">
                {isDetailRoute
                  ? "The requested application does not exist or is no longer available."
                  : "Choose an application from the left pane to view its configuration and diff."}
              </div>
            </div>
          </div>
        </main>
      ) : (
        <DashboardDetailPane
          isDetailRoute={isDetailRoute}
          mobileHeader={
            <header className="sticky top-0 z-20 h-16 bg-gray-50 px-4 sm:px-6 lg:hidden">
              <div className="flex h-full items-center gap-4">
                <Link
                  href={buildDashboardHref(
                    null,
                    filterPattern,
                    selectedStatuses
                  )}
                  className="flex items-center gap-3"
                >
                  <GitBranch className="h-7 w-7 text-primary" />
                  <div className="text-2xl font-bold text-gray-900">ecscd</div>
                </Link>
              </div>
            </header>
          }
          stickyHeader={
            <div className="flex items-center gap-3">
              <Link
                href={buildDashboardHref(
                  null,
                  filterPattern,
                  selectedStatuses
                )}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md lg:hidden hover:bg-zinc-100"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-2xl font-semibold text-gray-900">
                {selectedApplicationConfig.name}
              </h1>
              <ApplicationStatusBadge
                application={selectedApplication || selectedApplicationConfig}
              />
            </div>
          }
          headerActions={
            <a
              href={getEcsDeploymentsConsoleUrl(selectedApplicationConfig)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-gray-900 hover:underline text-sm"
            >
              View in AWS Console
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          }
          body={
            <>
              <div className="space-y-6 px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10">
                <div className="mt-6 grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
                  <div>
                    <div className="text-gray-500 mb-1">GitHub</div>
                    {gitLinks ? (
                      <a
                        href={gitLinks.branchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium break-all text-gray-900 hover:underline"
                      >
                        {selectedApplicationConfig.gitConfig.repo} @
                        {selectedApplicationConfig.gitConfig.branch}
                      </a>
                    ) : (
                      <div className="font-medium break-all text-gray-900">
                        {selectedApplicationConfig.gitConfig.repo} @
                        {selectedApplicationConfig.gitConfig.branch}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Task Definition Path</div>
                    {gitLinks ? (
                      <a
                        href={gitLinks.taskDefinitionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium break-all text-gray-900 hover:underline"
                      >
                        {selectedApplicationConfig.gitConfig.path}
                      </a>
                    ) : (
                      <div className="font-medium break-all text-gray-900">
                        {selectedApplicationConfig.gitConfig.path}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">ECS Cluster</div>
                    <a
                      href={getEcsClusterConsoleUrl(selectedApplicationConfig)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {selectedApplicationConfig.ecsConfig.cluster}
                    </a>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">ECS Service</div>
                    <a
                      href={getEcsServiceConsoleUrl(selectedApplicationConfig)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {selectedApplicationConfig.ecsConfig.service}
                    </a>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">AWS Region</div>
                    <div className="font-medium">
                      {selectedApplicationConfig.awsConfig.region || "us-east-1"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      Last Synced
                    </div>
                    <div className="font-medium">
                      {formatLastSyncTime(
                        selectedApplication?.sync.status === "Success"
                          ? selectedApplication.sync.value?.lastSyncedAt
                          : undefined
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-8 sm:px-6 lg:px-8">
                {selectedApplication ? (
                  <DiffViewer
                    application={selectedApplication}
                    deploymentUrl={getEcsDeploymentsConsoleUrl(selectedApplication)}
                  />
                ) : (
                  <DiffViewer
                    application={selectedApplicationConfig}
                    deploymentUrl={getEcsDeploymentsConsoleUrl(selectedApplicationConfig)}
                  />
                )}
              </div>
            </>
          }
          syncActions={
            <DashboardSyncActions
              applicationName={selectedApplicationConfig.name}
              status={getApplicationStatus(
                selectedApplication || selectedApplicationConfig
              ).status}
              hasActiveDeployment={
                getApplicationStatus(
                  selectedApplication || selectedApplicationConfig
                ).status === "Deploying"
              }
              onApplicationChanged={handleApplicationChanged}
            />
          }
        />
      )}
    </div>
  );
}
