"use client";

import {
  ApplicationStatusBadge,
  ApplicationStatusDot,
} from "@/components/application/status-indicator";
import { DashboardDetailPane } from "@/components/dashboard/detail-pane";
import { DashboardEditApplicationButton } from "@/components/dashboard/edit-application-button";
import { DashboardLastDeployment } from "@/components/dashboard/last-deployment";
import {
  buildDashboardHref,
  getEcsClusterConsoleUrl,
  getEcsDeploymentsConsoleUrl,
  getEcsServiceConsoleUrl,
  getGitLinks,
} from "@/components/dashboard/links";
import { DashboardNewApplicationButton } from "@/components/dashboard/new-application-button";
import { DashboardSidebarPane } from "@/components/dashboard/sidebar-pane";
import { DashboardSyncActions } from "@/components/dashboard/sync-actions";
import { DiffViewer } from "@/components/diff/diff-viewer";
import { FilterSelector } from "@/components/filter/filter-selector";
import { formatRelativeTime } from "@/components/dashboard/format";
import {
  ApplicationDomain,
  ObservedApplicationDomain,
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
  data?: ObservedApplicationDomain;
  promise?: Promise<void>;
};

const applicationCache = new Map<string, CacheEntry>();
const DEPLOYMENT_POLLING_INTERVAL_MS = 5_000;
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
): ObservedApplicationDomain {
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
    observedAt: new Date(),
  };
}

function getCachedApplication(
  config: ApplicationDomain,
): ObservedApplicationDomain | null {
  const entry = applicationCache.get(config.name);
  if (!entry?.data) {
    return null;
  }

  return entry.data;
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
  const displayApplication = selectedApplication || selectedApplicationConfig;
  const displayApplicationStatus = displayApplication
    ? getApplicationStatus(displayApplication).status
    : "Loading";
  const isDetailRoute = selectedAppName !== null;
  const gitLinks = selectedApplicationConfig
    ? getGitLinks(selectedApplicationConfig)
    : null;

  const loadApplication = useCallback((
    config: ApplicationDomain,
    options: { force?: boolean } = {}
  ) => {
    const existing = applicationCache.get(config.name);
    if (existing?.promise || (existing?.data && !options.force)) {
      return;
    }

    const entry = existing || {};
    entry.promise = (async () => {
      try {
        const response = await fetch(`/api/apps/${encodeURIComponent(config.name)}`);
        if (!response.ok) {
          throw new Error("Failed to fetch application");
        }

        entry.data = (await response.json()) as ObservedApplicationDomain;
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

  useEffect(() => {
    if (
      !selectedApplicationConfig ||
      displayApplicationStatus !== "Deploying"
    ) {
      return;
    }

    loadApplication(selectedApplicationConfig, { force: true });
    const intervalId = window.setInterval(() => {
      loadApplication(selectedApplicationConfig, { force: true });
    }, DEPLOYMENT_POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [displayApplicationStatus, loadApplication, selectedApplicationConfig]);

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
    <div className="h-screen bg-background text-foreground grid grid-cols-1 lg:grid-cols-[360px_1fr]">
      <aside
        className={`bg-card flex flex-col min-h-0 relative ${
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
              <h1 className="text-2xl font-bold text-foreground">ecscd</h1>
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
              <div className="p-4 text-sm text-muted-foreground">
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
                          ? "bg-accent"
                          : "bg-transparent hover:bg-accent/70"
                      }`}
                    >
                      <Link href={href} className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <ApplicationStatusDot application={displayApplication} />
                          <div className="font-medium text-foreground truncate">
                            {application.name}
                          </div>
                        </div>
                        <div className="mt-0.5 pl-4 text-xs text-muted-foreground truncate">
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
          className={`min-h-0 overflow-y-auto relative pane-shadow-left ${
            isDetailRoute ? "block" : "hidden lg:flex"
          }`}
        >
          <div className="flex min-h-full items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
            <div className="max-w-md text-center">
              <div className="text-base font-medium text-foreground">
                {isDetailRoute
                  ? "Application not found"
                  : "Select an application"}
              </div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">
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
            <header className="sticky top-0 z-20 h-16 bg-background px-4 sm:px-6 lg:hidden">
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
                  <div className="text-2xl font-bold text-foreground">ecscd</div>
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-md lg:hidden hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-2xl font-semibold text-foreground">
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
              className="inline-flex items-center gap-2 text-foreground hover:underline text-sm"
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
                    <div className="text-muted-foreground mb-1">GitHub</div>
                    {gitLinks ? (
                      <a
                        href={gitLinks.branchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium break-all text-foreground hover:underline"
                      >
                        {selectedApplicationConfig.gitConfig.repo} @
                        {selectedApplicationConfig.gitConfig.branch}
                      </a>
                    ) : (
                      <div className="font-medium break-all text-foreground">
                        {selectedApplicationConfig.gitConfig.repo} @
                        {selectedApplicationConfig.gitConfig.branch}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Task Definition Path</div>
                    {gitLinks ? (
                      <a
                        href={gitLinks.taskDefinitionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium break-all text-foreground hover:underline"
                      >
                        {selectedApplicationConfig.gitConfig.path}
                      </a>
                    ) : (
                      <div className="font-medium break-all text-foreground">
                        {selectedApplicationConfig.gitConfig.path}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">ECS Cluster</div>
                    <a
                      href={getEcsClusterConsoleUrl(selectedApplicationConfig)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:underline"
                    >
                      {selectedApplicationConfig.ecsConfig.cluster}
                    </a>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">ECS Service</div>
                    <a
                      href={getEcsServiceConsoleUrl(selectedApplicationConfig)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:underline"
                    >
                      {selectedApplicationConfig.ecsConfig.service}
                    </a>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">AWS Region</div>
                    <div className="font-medium">
                      {selectedApplicationConfig.awsConfig.region || "us-east-1"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      Last Synced
                    </div>
                    <div className="font-medium">
                      {formatRelativeTime(
                        selectedApplication?.sync.status === "Success"
                          ? selectedApplication.sync.value?.lastSyncedAt
                          : undefined
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8 px-4 pb-8 sm:px-6 lg:px-8">
                {selectedApplication ? (
                  <DashboardLastDeployment
                    application={selectedApplication}
                    deploymentUrl={getEcsDeploymentsConsoleUrl(selectedApplication)}
                  />
                ) : null}
                {displayApplicationStatus === "Deploying" ? null : (
                  <DiffViewer
                    application={selectedApplication || selectedApplicationConfig}
                  />
                )}
              </div>
            </>
          }
          syncActions={
            <DashboardSyncActions
              applicationName={selectedApplicationConfig.name}
              status={displayApplicationStatus}
              hasActiveDeployment={displayApplicationStatus === "Deploying"}
              onApplicationChanged={handleApplicationChanged}
            />
          }
        />
      )}
    </div>
  );
}
