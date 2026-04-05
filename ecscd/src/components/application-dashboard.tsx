"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DiffViewer } from "@/components/diff-viewer";
import { NewApplicationDialog } from "@/components/new-application-dialog";
import { EditApplicationDialog } from "@/components/edit-application-dialog";
import { FilterSelector } from "@/components/filter-selector";
import {
  ApplicationStatusBadge,
  ApplicationStatusDot,
} from "@/components/application-status-indicator";
import { ApplicationDomain, DiffDomain } from "@/lib/domain/application";
import { Button } from "@/components/ui/button";
import {
  Plus,
  RefreshCw,
  GitBranch,
  Edit,
  Play,
  Undo2,
  ExternalLink,
  Clock,
  ArrowDown,
  ArrowLeft,
} from "lucide-react";

type DiffResponse = {
  error?: string;
  diffs: DiffDomain[];
  summary?: string;
};

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

function getGitTaskDefinitionUrl(application: ApplicationDomain) {
  const repo = application.gitConfig.repo.replace(/\/$/, "");
  const branch = encodeURIComponent(application.gitConfig.branch);
  const path = application.gitConfig.path
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${repo}/blob/${branch}/${path}`;
}

export function ApplicationDashboard() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedAppNameFromRoute = useMemo(() => {
    const match = pathname.match(/^\/apps\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  const [applications, setApplications] = useState<ApplicationDomain[]>([]);
  const [selectedAppName, setSelectedAppName] = useState<string | null>(
    selectedAppNameFromRoute
  );
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [showNewAppDialog, setShowNewAppDialog] = useState(false);
  const [showEditAppDialog, setShowEditAppDialog] = useState(false);
  const [editingApp, setEditingApp] = useState<ApplicationDomain | null>(null);
  const [deployingApps, setDeployingApps] = useState<Set<string>>(new Set());
  const [filterPattern, setFilterPattern] = useState("");
  const [isFilterInitialized, setIsFilterInitialized] = useState(false);
  const [isListScrolled, setIsListScrolled] = useState(false);
  const [isDetailsScrolled, setIsDetailsScrolled] = useState(false);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const detailsScrollRef = useRef<HTMLElement | null>(null);
  const syncActionsRef = useRef<HTMLDivElement | null>(null);
  const [isSyncActionsVisible, setIsSyncActionsVisible] = useState(true);
  const isDetailRoute = selectedAppNameFromRoute !== null;

  const selectedApp = useMemo(
    () => applications.find((app) => app.name === selectedAppName) || null,
    [applications, selectedAppName]
  );

  const hasActiveDeployment = useMemo(() => {
    if (!selectedApp) return false;
    return (
      deployingApps.has(selectedApp.name) || selectedApp.status === "Deploying"
    );
  }, [deployingApps, selectedApp]);

  const syncStatsLabel = useMemo(() => {
    const total = applications.length;
    const inSyncCount = applications.filter(
      (app) => app.status === "InSync"
    ).length;

    if (total === 0) {
      return "0% (0/0) In Sync";
    }

    const percent = Math.round((inSyncCount / total) * 100);
    return `${percent}% (${inSyncCount}/${total}) In Sync`;
  }, [applications]);

  const getNavigationUrl = useCallback(
    (appName?: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      const query = params.toString();
      const pathname = appName ? `/apps/${encodeURIComponent(appName)}` : "/";
      return query ? `${pathname}?${query}` : pathname;
    },
    [searchParams]
  );

  useEffect(() => {
    setSelectedAppName(selectedAppNameFromRoute);
  }, [selectedAppNameFromRoute]);

  const handleFilterChange = useCallback(
    (pattern: string, isInitializing = false) => {
      setFilterPattern(pattern);
      if (isInitializing) {
        setIsFilterInitialized(true);
      }
    },
    []
  );

  const loadApplications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPattern) {
        params.set("filter", filterPattern);
      }

      const response = await fetch(`/api/apps?${params.toString()}`);
      const data = await response.json();
      const loadedApplications = (data.applications || []) as ApplicationDomain[];
      setApplications(loadedApplications);

      setSelectedAppName((prev) => {
        if (loadedApplications.length === 0) {
          return null;
        }

        if (selectedAppNameFromRoute) {
          const routeAppExists = loadedApplications.some(
            (app) => app.name === selectedAppNameFromRoute
          );
          return routeAppExists ? selectedAppNameFromRoute : null;
        }

        if (!prev) {
          return null;
        }
        const stillExists = loadedApplications.some((app) => app.name === prev);
        return stillExists ? prev : null;
      });
    } catch (error) {
      console.error("Failed to load applications:", error);
      toast.error("Failed to load applications");
    } finally {
      setIsLoading(false);
    }
  }, [filterPattern, selectedAppNameFromRoute]);

  const loadDiff = useCallback(async (appName: string) => {
    setIsDiffLoading(true);
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appName)}/diff`);
      const data = await response.json();
      setDiffData(data);
    } catch (error) {
      console.error("Failed to load diff:", error);
      setDiffData({
        error: "Failed to load diff data",
        diffs: [],
      });
    } finally {
      setIsDiffLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isFilterInitialized) return;
    loadApplications();
  }, [isFilterInitialized, loadApplications]);

  useEffect(() => {
    if (!selectedAppName) {
      setDiffData(null);
      return;
    }
    loadDiff(selectedAppName);
  }, [selectedAppName, loadDiff]);

  const handleSync = useCallback(
    async (appName: string) => {
      setDeployingApps((prev) => new Set(prev).add(appName));
      try {
        const response = await fetch(`/api/apps/${encodeURIComponent(appName)}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dryRun: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Sync failed");
        }

        await response.json();
        await loadApplications();
        if (selectedAppName === appName) {
          await loadDiff(appName);
        }
      } catch (error) {
        console.error("Failed to start sync:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        toast.error(`Sync failed for ${appName}`, {
          description: errorMessage,
        });
      } finally {
        setDeployingApps((prev) => {
          const next = new Set(prev);
          next.delete(appName);
          return next;
        });
      }
    },
    [loadApplications, loadDiff, selectedAppName]
  );

  const handleRollback = useCallback(
    async (appName: string) => {
      setDeployingApps((prev) => new Set(prev).add(appName));
      try {
        const response = await fetch(
          `/api/apps/${encodeURIComponent(appName)}/rollback`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dryRun: false,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Rollback failed");
        }

        await response.json();
        await loadApplications();
        if (selectedAppName === appName) {
          await loadDiff(appName);
        }
      } catch (error) {
        console.error("Failed to start rollback:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        toast.error(`Rollback failed for ${appName}`, {
          description: errorMessage,
        });
      } finally {
        setDeployingApps((prev) => {
          const next = new Set(prev);
          next.delete(appName);
          return next;
        });
      }
    },
    [loadApplications, loadDiff, selectedAppName]
  );

  const handleDeleteApplication = useCallback(
    async (appName: string) => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appName)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Delete failed");
      }

      await loadApplications();
      if (selectedAppName === appName) {
        setSelectedAppName(null);
        setDiffData(null);
        router.push(getNavigationUrl(null), { scroll: false });
      }
    },
    [getNavigationUrl, loadApplications, router, selectedAppName]
  );

  const handleOpenEditDialog = useCallback((application: ApplicationDomain) => {
    setEditingApp(application);
    setShowEditAppDialog(true);
  }, []);

  useEffect(() => {
    const list = listContainerRef.current;
    if (!list) return;
    setIsListScrolled(list.scrollTop > 0);
  }, [applications.length, isLoading]);

  const updateSyncActionsVisibility = useCallback(() => {
    if (!selectedApp) {
      setIsSyncActionsVisible(true);
      return;
    }
    const container = detailsScrollRef.current;
    const actions = syncActionsRef.current;
    if (!container || !actions) {
      setIsSyncActionsVisible(true);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const visible =
      actionsRect.bottom > containerRect.top &&
      actionsRect.top < containerRect.bottom;
    setIsSyncActionsVisible(visible);
  }, [selectedApp]);

  useEffect(() => {
    const id = window.requestAnimationFrame(updateSyncActionsVisibility);
    return () => window.cancelAnimationFrame(id);
  }, [updateSyncActionsVisibility, selectedApp, isDiffLoading, hasActiveDeployment]);

  useEffect(() => {
    if (!selectedApp) return;

    const handleResize = () => updateSyncActionsVisibility();
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      updateSyncActionsVisibility();
    });
    if (detailsScrollRef.current) {
      resizeObserver.observe(detailsScrollRef.current);
    }
    if (syncActionsRef.current) {
      resizeObserver.observe(syncActionsRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [selectedApp, updateSyncActionsVisibility]);

  return (
    <div className="h-screen bg-gray-50 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
      <aside
        className={`bg-white flex flex-col min-h-0 relative ${
          isDetailRoute ? "hidden lg:flex" : "flex"
        }`}
      >
        <header className="h-16 shrink-0 px-4 sm:px-6 flex items-center relative">
          <div className="flex w-full items-center justify-between gap-4">
            <Link href={getNavigationUrl(null)} className="flex items-center gap-3">
              <GitBranch className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">ecscd</h1>
            </Link>
            <div className="text-sm font-medium text-gray-500">{syncStatsLabel}</div>
          </div>
        </header>

        <div
          className={`p-4 relative transition-shadow ${
            isListScrolled
              ? "shadow-[0_6px_12px_-10px_rgba(15,23,42,0.35)]"
              : "shadow-none"
          }`}
        >
          <Suspense
            fallback={
              <div className="w-full h-10 bg-gray-100 rounded-md animate-pulse" />
            }
          >
            <FilterSelector onFilterChange={handleFilterChange} />
          </Suspense>
        </div>

        <div
          ref={listContainerRef}
          onScroll={(event) =>
            setIsListScrolled(event.currentTarget.scrollTop > 0)
          }
          className="subtle-scrollbar flex-1 overflow-y-auto relative"
        >
          {isLoading && applications.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-600">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">
              No applications configured yet
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {applications.map((application) => (
                <div
                  key={application.name}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    router.push(getNavigationUrl(application.name), {
                      scroll: false,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(getNavigationUrl(application.name), {
                        scroll: false,
                      });
                    }
                  }}
                  className={`w-full text-left rounded-md px-3 py-2 transition-colors ${
                    selectedAppName === application.name
                      ? "bg-zinc-100"
                      : "bg-transparent hover:bg-zinc-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <ApplicationStatusDot application={application} />
                      <div className="font-medium text-gray-900 truncate">
                        {application.name}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenEditDialog(application);
                      }}
                      className="h-7 w-7 shrink-0 text-zinc-600 hover:text-zinc-900"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="mt-0.5 pl-4 text-xs text-zinc-500 truncate">
                    {application.gitConfig.repo} @{application.gitConfig.branch}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShowNewAppDialog(true)}
                className="w-full text-left rounded-md px-3 py-2 transition-colors bg-transparent text-zinc-700 hover:bg-zinc-100/70"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Plus className="h-4 w-4" />
                  New Application
                </div>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main
        ref={detailsScrollRef}
        onScroll={(event) => {
          setIsDetailsScrolled(event.currentTarget.scrollTop > 0);
          updateSyncActionsVisibility();
        }}
        className={`subtle-scrollbar min-h-0 overflow-y-auto relative shadow-[-4px_0_14px_rgba(15,23,42,0.12)] ${
          isDetailRoute ? "block" : "hidden lg:block"
        }`}
      >
        {!selectedApp ? (
          <div className="h-full flex items-center justify-center text-gray-600">
            {isDetailRoute ? "Application not found." : "Select an application from the left pane."}
          </div>
        ) : (
          <>
            <header className="sticky top-0 z-20 h-16 bg-gray-50 px-4 sm:px-6 lg:hidden">
              <div className="flex h-full items-center justify-between gap-4">
                <Link href={getNavigationUrl(null)} className="flex items-center gap-3">
                  <GitBranch className="h-7 w-7 text-primary" />
                  <div className="text-2xl font-bold text-gray-900">ecscd</div>
                </Link>
                <div className="text-sm font-medium text-gray-500">{syncStatsLabel}</div>
              </div>
            </header>
            <section
              className={`sticky top-16 z-10 h-[76px] bg-gray-50 px-4 sm:px-6 lg:top-0 lg:px-8 transition-shadow ${
                isDetailsScrolled
                  ? "shadow-[0_6px_12px_-10px_rgba(15,23,42,0.35)]"
                  : "shadow-none"
                }`}
              >
                <div className="flex h-full items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(getNavigationUrl(null), { scroll: false })}
                        className="h-8 w-8 lg:hidden"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <h1 className="text-2xl font-semibold text-gray-900">
                        {selectedApp.name}
                      </h1>
                      <ApplicationStatusBadge application={selectedApp} />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <a
                      href={getEcsDeploymentsConsoleUrl(selectedApp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View in AWS Console
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-out ${
                        isSyncActionsVisible
                          ? "ml-0 max-w-0 opacity-0"
                          : "ml-3 max-w-[140px] opacity-100"
                      }`}
                    >
                      <Button
                        onClick={() =>
                          syncActionsRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          })
                        }
                        aria-hidden={isSyncActionsVisible}
                        tabIndex={isSyncActionsVisible ? -1 : 0}
                        className={isSyncActionsVisible ? "pointer-events-none" : ""}
                      >
                        <ArrowDown className="h-4 w-4 mr-2" />
                        Sync...
                      </Button>
                    </div>
                  </div>
                </div>
            </section>

            <div className="space-y-6 px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10">
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">GitHub</div>
                  <a
                    href={`${selectedApp.gitConfig.repo.replace(/\/$/, "")}/tree/${encodeURIComponent(
                      selectedApp.gitConfig.branch
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium break-all text-gray-900 hover:underline"
                  >
                    {selectedApp.gitConfig.repo} @{selectedApp.gitConfig.branch}
                  </a>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Task Definition Path</div>
                  <a
                    href={getGitTaskDefinitionUrl(selectedApp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium break-all text-gray-900 hover:underline"
                  >
                    {selectedApp.gitConfig.path}
                  </a>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">ECS Cluster</div>
                  <a
                    href={getEcsClusterConsoleUrl(selectedApp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:underline"
                  >
                    {selectedApp.ecsConfig.cluster}
                  </a>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">ECS Service</div>
                  <a
                    href={getEcsServiceConsoleUrl(selectedApp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:underline"
                  >
                    {selectedApp.ecsConfig.service}
                  </a>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">AWS Region</div>
                  <div className="font-medium">
                    {selectedApp.awsConfig.region || "us-east-1"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Last Synced
                  </div>
                  <div className="font-medium">
                    {formatLastSyncTime(selectedApp.sync.lastSyncedAt)}
                  </div>
                </div>
              </div>
            </div>

            {isDiffLoading ? (
              <div className="px-4 pb-8 sm:px-6 lg:px-8 py-12 flex items-center justify-center text-gray-600">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading diff...
              </div>
            ) : (
              <div className="px-4 pb-8 sm:px-6 lg:px-8">
                <DiffViewer
                  diffs={diffData?.diffs || []}
                  summary={diffData?.summary || `${(diffData?.diffs || []).length} changes`}
                  isLoading={hasActiveDeployment}
                  error={diffData?.error}
                />
              </div>
            )}

            <div ref={syncActionsRef} className="px-4 pb-8 sm:px-6 lg:px-8">
              <div className="flex justify-end">
                <div className="flex items-center gap-2">
                  {hasActiveDeployment && (
                    <Button
                      variant="destructive"
                      onClick={() => handleRollback(selectedApp.name)}
                      disabled={!hasActiveDeployment}
                      className="ui-soft-in"
                    >
                      <Undo2 className="h-4 w-4 mr-2" />
                      Rollback
                    </Button>
                  )}
                  <Button
                    onClick={() => handleSync(selectedApp.name)}
                    disabled={hasActiveDeployment}
                    className={`${
                      hasActiveDeployment
                        ? "ui-expand-in bg-zinc-200 text-zinc-700 hover:bg-zinc-200"
                        : ""
                    }`}
                  >
                    <Play
                      className={`h-4 w-4 mr-2 ${
                        hasActiveDeployment ? "animate-spin" : ""
                      }`}
                    />
                    <span>{hasActiveDeployment ? "Deploying..." : "Sync"}</span>
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <NewApplicationDialog
        open={showNewAppDialog}
        onOpenChange={setShowNewAppDialog}
        onSuccess={loadApplications}
      />

      <EditApplicationDialog
        open={showEditAppDialog}
        onOpenChange={setShowEditAppDialog}
        application={editingApp}
        onSuccess={loadApplications}
        onDelete={handleDeleteApplication}
      />
    </div>
  );
}
