"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApplicationDomain } from "@/lib/domain/application";
import {
  GitBranch,
  RefreshCw,
  Play,
  ExternalLink,
  Clock,
  Trash2,
  Edit,
  Undo2,
} from "lucide-react";

interface ApplicationCardProps {
  appName: string;
  onSync?: (appName: string) => void;
  onViewDiff?: (appName: string) => void;
  onEdit?: (appName: string) => void;
  onDelete?: (appName: string) => void;
  onRollback?: (appName: string) => void;
  isDeploymentActive?: boolean;
  onDeploymentComplete?: () => void;
  onDataLoaded?: (application: ApplicationDomain) => void;
}

export function ApplicationCard({
  appName,
  onSync,
  onViewDiff,
  onEdit,
  onDelete,
  onRollback,
  isDeploymentActive = false,
  onDataLoaded,
}: ApplicationCardProps) {
  const [application, setApplication] = useState<ApplicationDomain | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const previousApplicationRef = useRef<ApplicationDomain | null>(null);

  const loadApplication = useCallback(async () => {
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appName)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch application");
      }
      const data = await response.json();
      const newApplication = data.application as ApplicationDomain;

      // Only update if there are actual changes
      const hasChanges =
        JSON.stringify(newApplication) !==
        JSON.stringify(previousApplicationRef.current);

      if (hasChanges) {
        previousApplicationRef.current = newApplication;
        setApplication(newApplication);
        onDataLoaded?.(newApplication);
      }
    } catch (error) {
      console.error(`Failed to load application ${appName}:`, error);
    } finally {
      setIsLoadingData(false);
    }
  }, [appName, onDataLoaded]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  // Poll for deployment status every 5 seconds when deployment is in progress
  useEffect(() => {
    const hasInProgressDeployment =
      isDeploymentActive ||
      application?.service?.deployments.some(
        (d) => d.rolloutState === "IN_PROGRESS"
      );

    if (!hasInProgressDeployment) {
      return;
    }

    const interval = setInterval(() => {
      loadApplication();
    }, 5000);

    return () => clearInterval(interval);
  }, [application, isDeploymentActive, loadApplication]);

  // Check for active deployment from both props and service state
  const hasActiveDeployment =
    isDeploymentActive ||
    application?.service?.deployments.some(
      (d) => d.rolloutState === "IN_PROGRESS"
    ) ||
    false;

  const hasRollbackDeployment =
    application?.service?.deployments.some((d) =>
      d.rolloutStateReason.includes("rolling back to")
    ) || false;

  const getSyncStatusColor = (status: string) => {
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
  };

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "success";
      default:
        return "secondary";
    }
  };

  const getDeploymentStatusColor = (status: string) => {
    switch (status) {
      case "PRIMARY":
        return "success";
      case "ACTIVE":
        return "success";
      case "PENDING":
      case "RUNNING":
        return "warning";
      case "DRAINING":
        return "warning";
      case "INACTIVE":
      case "STOPPED":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getRolloutStateColor = (rolloutState: string) => {
    switch (rolloutState) {
      case "COMPLETED":
        return "success";
      case "IN_PROGRESS":
        return "warning";
      case "FAILED":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const handleSync = () => {
    if (!application) return;
    setIsLoading(true);
    onSync?.(application.name);
  };

  const handleDelete = () => {
    if (!application) return;
    setShowDeleteConfirm(false);
    onDelete?.(application.name);
  };

  const handleRollback = () => {
    if (!application) return;
    setIsLoading(true);
    onRollback?.(application.name);
  };

  const formatLastSyncTime = (date?: Date) => {
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
  };

  const extractRevisionFromArn = (revision?: string) => {
    console.log("extractRevisionFromArn input:", revision);

    if (!revision) return null;

    // If it's a task definition ARN, extract the revision number
    if (revision.includes(":task-definition/")) {
      const parts = revision.split(":");
      const familyAndRevision = parts[parts.length - 1]; // e.g., "my-task:123"
      const revisionPart = familyAndRevision.split(":")[1]; // e.g., "123"
      const result = revisionPart || familyAndRevision;
      console.log("Extracted from task definition ARN:", result);
      return result;
    }

    // If it starts with "deployment-", show first 8 characters
    if (revision.startsWith("deployment-")) {
      const result = revision.substring(0, 8);
      console.log("Extracted from deployment ID:", result);
      return result;
    }

    // Otherwise, show first 8 characters
    const result = revision.substring(0, 8);
    console.log("Extracted fallback:", result);
    return result;
  };

  // Loading state
  if (isLoadingData) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-600" />
            <span className="text-gray-600">Loading {appName}...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state (application not found)
  if (!application) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="text-center text-gray-600">
            Failed to load application: {appName}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {application.name}
          </CardTitle>
          <div className="flex gap-2">
            <Badge
              variant={getServiceStatusColor(
                application.service?.status || "Unknown"
              )}
            >
              {application.service?.status || "Unknown"}
            </Badge>
            <Badge
              variant={getSyncStatusColor(application.sync.status || "Unknown")}
            >
              {application.sync.status || "Unknown"}
            </Badge>
          </div>
        </div>
        <CardDescription className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {application.gitConfig.repo}
          {application.gitConfig.branch && (
            <span className="text-gray-500">
              @ {application.gitConfig.branch}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-600">ECS Cluster</div>
              <div>{application.ecsConfig.cluster}</div>
            </div>
            <div>
              <div className="font-medium text-gray-600">ECS Service</div>
              <div>{application.ecsConfig.service}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            Last synced: {formatLastSyncTime(application.sync.lastSyncedAt)}
          </div>

          {application.service?.taskDefinition && (
            <div className="text-sm">
              <span className="font-medium text-gray-600">Revision: </span>
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                {extractRevisionFromArn(application.service?.taskDefinition)}
              </code>
            </div>
          )}

          {application.service?.deployments.some(
            (d) => d.status === "PRIMARY"
          ) && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-600">
                Latest Deployment
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Status:</span>
                  <Badge
                    variant={getDeploymentStatusColor(
                      application.service?.deployments.filter(
                        (d) => d.status === "PRIMARY"
                      )[0].status || "Unknown"
                    )}
                    className="ml-2"
                  >
                    {
                      application.service?.deployments.filter(
                        (d) => d.status === "PRIMARY"
                      )[0].status
                    }
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-500">Tasks:</span>
                  <span className="ml-2 font-mono">
                    {application.service?.runningCount}/
                    {application.service?.desiredCount}
                  </span>
                </div>
              </div>
              {application.service?.deployments.some(
                (d) => d.status === "PRIMARY"
              ) && (
                <div className="text-sm">
                  <span className="text-gray-500">Rollout:</span>
                  <Badge
                    variant={getRolloutStateColor(
                      application.service?.deployments.filter(
                        (d) => d.status === "PRIMARY"
                      )[0].rolloutState
                    )}
                    className="ml-2"
                  >
                    {
                      application.service?.deployments.filter(
                        (d) => d.status === "PRIMARY"
                      )[0].rolloutState
                    }
                  </Badge>
                  {application.service?.deployments.some(
                    (d) => d.status === "PRIMARY"
                  ) && (
                    <div className="text-xs text-gray-500 mt-1">
                      {
                        application.service?.deployments.filter(
                          (d) => d.status === "PRIMARY"
                        )[0].rolloutStateReason
                      }
                    </div>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500">
                <div>
                  Created:{" "}
                  {formatLastSyncTime(
                    application.service?.deployments.filter(
                      (d) => d.status === "PRIMARY"
                    )[0].createdAt
                  )}
                </div>
                <div>
                  Updated:{" "}
                  {formatLastSyncTime(
                    application.service?.deployments.filter(
                      (d) => d.status === "PRIMARY"
                    )[0].updatedAt
                  )}
                </div>
              </div>
            </div>
          )}

          {hasActiveDeployment && (
            <div className="p-3 bg-gray-100 rounded-md">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="font-medium">
                  {application.service?.deployments.filter(
                    (d) => d.status === "PRIMARY"
                  )[0]?.rolloutState || "Deploying..."}
                </span>
              </div>
              {application.service?.deployments.some(
                (d) => d.status === "PRIMARY"
              ) && (
                <p className="text-sm text-gray-600 mt-1">
                  {
                    application.service?.deployments.filter(
                      (d) => d.status === "PRIMARY"
                    )[0].rolloutStateReason
                  }
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiff?.(application.name)}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          View Diff
        </Button>

        <Button
          size="sm"
          onClick={handleSync}
          disabled={isLoading || hasActiveDeployment}
          className="flex items-center gap-2"
        >
          <Play
            className={`h-4 w-4 ${hasActiveDeployment ? "animate-spin" : ""}`}
          />
          {hasActiveDeployment
            ? "Deploying..."
            : isLoading
            ? "Starting..."
            : "Sync"}
        </Button>

        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit?.(application.name)}
            disabled={isLoading || hasActiveDeployment}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        )}

        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isLoading || hasActiveDeployment}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
        {hasActiveDeployment && onRollback && (
          <Button
            variant="outline"
            onClick={handleRollback}
            disabled={isLoading || hasRollbackDeployment}
            className="flex items-center gap-2"
          >
            <Undo2 className="h-4 w-4" />
            Rollback
          </Button>
        )}
      </CardFooter>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Application</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete &quot;{application.name}&quot;?
              This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
