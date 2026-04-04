"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { toast } from "sonner";
import { DiffViewer } from "@/components/diff-viewer";
import { NewApplicationDialog } from "@/components/new-application-dialog";
import { EditApplicationDialog } from "@/components/edit-application-dialog";
import { FilterSelector } from "@/components/filter-selector";
import { ApplicationDomain, DiffDomain } from "@/lib/domain/application";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  RefreshCw,
  GitBranch,
  Edit,
  Play,
  Undo2,
  ExternalLink,
  Clock,
} from "lucide-react";

type DiffResponse = {
  error?: string;
  diffs: DiffDomain[];
  summary?: string;
};

function getSyncBadgeVariant(status: ApplicationDomain["sync"]["status"]) {
  switch (status) {
    case "InSync":
      return "success";
    case "OutOfSync":
      return "warning";
    case "Error":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatSyncStatus(status: ApplicationDomain["sync"]["status"]) {
  switch (status) {
    case "InSync":
      return "In Sync";
    case "OutOfSync":
      return "Out of Sync";
    case "Error":
      return "Error";
    default:
      return "Unknown";
  }
}

function getSyncDotClass(status: ApplicationDomain["sync"]["status"]) {
  switch (status) {
    case "InSync":
      return "bg-emerald-500";
    case "OutOfSync":
      return "bg-amber-500";
    case "Error":
      return "bg-rose-500";
    default:
      return "bg-zinc-400";
  }
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

function getEcsConsoleUrl(application: ApplicationDomain) {
  const region = application.awsConfig.region || "us-east-1";
  const cluster = application.ecsConfig.cluster;
  const service = application.ecsConfig.service;
  return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${encodeURIComponent(
    cluster
  )}/services/${encodeURIComponent(service)}/deployments?region=${region}`;
}

export default function Home() {
  const [applications, setApplications] = useState<ApplicationDomain[]>([]);
  const [selectedAppName, setSelectedAppName] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [showNewAppDialog, setShowNewAppDialog] = useState(false);
  const [showEditAppDialog, setShowEditAppDialog] = useState(false);
  const [editingApp, setEditingApp] = useState<ApplicationDomain | null>(null);
  const [deployingApps, setDeployingApps] = useState<Set<string>>(new Set());
  const [filterPattern, setFilterPattern] = useState("");
  const [isFilterInitialized, setIsFilterInitialized] = useState(false);

  const selectedApp = useMemo(
    () => applications.find((app) => app.name === selectedAppName) || null,
    [applications, selectedAppName]
  );

  const hasActiveDeployment = useMemo(() => {
    if (!selectedApp) return false;
    return (
      deployingApps.has(selectedApp.name) ||
      selectedApp.service?.deployments.some(
        (deployment) => deployment.rolloutState === "IN_PROGRESS"
      ) ||
      false
    );
  }, [deployingApps, selectedApp]);

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
        if (!prev) {
          return loadedApplications[0].name;
        }
        const stillExists = loadedApplications.some((app) => app.name === prev);
        return stillExists ? prev : loadedApplications[0].name;
      });
    } catch (error) {
      console.error("Failed to load applications:", error);
      toast.error("Failed to load applications");
    } finally {
      setIsLoading(false);
    }
  }, [filterPattern]);

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
      }
    },
    [loadApplications, selectedAppName]
  );

  const handleOpenEditDialog = useCallback((application: ApplicationDomain) => {
    setEditingApp(application);
    setShowEditAppDialog(true);
  }, []);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b h-16 shrink-0">
        <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">ecscd</h1>
          </div>
          <Button size="sm" onClick={() => setShowNewAppDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Application
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
        <aside className="bg-white border-r border-zinc-100 flex flex-col min-h-0">
          <div className="p-4 border-b border-zinc-100">
            <Suspense
              fallback={
                <div className="w-full h-10 bg-gray-100 rounded-md animate-pulse" />
              }
            >
              <FilterSelector onFilterChange={handleFilterChange} />
            </Suspense>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && applications.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-600">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : applications.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">
                No applications configured yet
              </div>
            ) : (
              <div>
                {applications.map((application) => (
                  <button
                    key={application.name}
                    type="button"
                    onClick={() => setSelectedAppName(application.name)}
                    className={`w-full text-left border-b border-zinc-100 px-4 py-2 transition-colors ${
                      selectedAppName === application.name
                        ? "bg-zinc-100/80"
                        : "bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${getSyncDotClass(
                            application.sync.status
                          )}`}
                          aria-label={`sync-status-${application.sync.status}`}
                        />
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
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {!selectedApp ? (
            <Card>
              <CardContent className="py-16 text-center text-gray-600">
                Select an application from the left pane.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl">
                        {selectedApp.name}
                      </CardTitle>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={getSyncBadgeVariant(selectedApp.sync.status)}>
                          {formatSyncStatus(selectedApp.sync.status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleOpenEditDialog(selectedApp)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleSync(selectedApp.name)}
                        disabled={hasActiveDeployment}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {hasActiveDeployment ? "Deploying..." : "Sync"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRollback(selectedApp.name)}
                        disabled={hasActiveDeployment}
                      >
                        <Undo2 className="h-4 w-4 mr-2" />
                        Rollback
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <div className="text-gray-500 mb-1">GitHub</div>
                      <div className="font-medium break-all">
                        {selectedApp.gitConfig.repo}
                      </div>
                      <div className="text-gray-600">@{selectedApp.gitConfig.branch}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Task Definition Path</div>
                      <div className="font-medium break-all">
                        {selectedApp.gitConfig.path}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">ECS Cluster</div>
                      <div className="font-medium">{selectedApp.ecsConfig.cluster}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">ECS Service</div>
                      <div className="font-medium">{selectedApp.ecsConfig.service}</div>
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

                  <div className="mt-4">
                    <a
                      href={getEcsConsoleUrl(selectedApp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View in AWS Console
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </CardContent>
              </Card>

              {isDiffLoading ? (
                <Card>
                  <CardContent className="py-12 flex items-center justify-center text-gray-600">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    Loading diff...
                  </CardContent>
                </Card>
              ) : (
                <DiffViewer
                  diffs={diffData?.diffs || []}
                  summary={diffData?.summary || `${(diffData?.diffs || []).length} changes`}
                  isLoading={hasActiveDeployment}
                  error={diffData?.error}
                />
              )}
            </div>
          )}
        </main>
      </div>

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
