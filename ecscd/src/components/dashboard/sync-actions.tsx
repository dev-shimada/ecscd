"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Play, Undo2 } from "lucide-react";
import { ApplicationStatus } from "@/lib/domain/application";

export function DashboardSyncActions({
  applicationName,
  status,
  hasActiveDeployment,
  onApplicationChanged,
}: {
  applicationName: string;
  status: ApplicationStatus;
  hasActiveDeployment: boolean;
  onApplicationChanged: (name: string) => void;
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [requestedDeployment, setRequestedDeployment] = useState(false);
  const syncButtonRef = useRef<HTMLButtonElement | null>(null);
  const [syncButtonWidth, setSyncButtonWidth] = useState(88);

  useEffect(() => {
    if (hasActiveDeployment) {
      setRequestedDeployment(false);
    }
  }, [hasActiveDeployment]);

  const handleSync = async () => {
    if (
      isSyncing ||
      isRollingBack ||
      hasActiveDeployment ||
      requestedDeployment
    ) {
      return;
    }

    setIsSyncing(true);
    setRequestedDeployment(true);

    try {
      const response = await fetch(
        `/api/apps/${encodeURIComponent(applicationName)}/sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Sync failed");
      }

      onApplicationChanged(applicationName);
    } catch (error) {
      setRequestedDeployment(false);
      toast.error(`Sync failed for ${applicationName}`, {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRollback = async () => {
    setIsRollingBack(true);

    try {
      const response = await fetch(
        `/api/apps/${encodeURIComponent(applicationName)}/rollback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Rollback failed");
      }

      toast.success(`Rollback requested for ${applicationName}`);
      onApplicationChanged(applicationName);
    } catch (error) {
      toast.error(`Rollback failed for ${applicationName}`, {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  const isDeploying =
    hasActiveDeployment || requestedDeployment || isSyncing || isRollingBack;
  const showRollback = hasActiveDeployment || isSyncing || isRollingBack;
  const syncLabel = isDeploying ? "Deploying..." : "Sync";

  useEffect(() => {
    const updateSyncButtonWidth = () => {
      const buttonStyle = syncButtonRef.current
        ? window.getComputedStyle(syncButtonRef.current)
        : null;
      const font = buttonStyle
        ? [
            buttonStyle.fontStyle,
            buttonStyle.fontVariant,
            buttonStyle.fontWeight,
            buttonStyle.fontSize,
            buttonStyle.lineHeight === "normal"
              ? ""
              : `/${buttonStyle.lineHeight}`,
            buttonStyle.fontFamily,
          ]
            .filter(Boolean)
            .join(" ")
        : "14px sans-serif";
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const textWidth = (() => {
        if (!context) return 0;
        context.font = font;
        return context.measureText(syncLabel).width;
      })();
      const horizontalPadding = 24;
      const iconWidth = 16;
      const gapWidth = 8;
      setSyncButtonWidth(
        Math.ceil(horizontalPadding + iconWidth + gapWidth + textWidth)
      );
    };

    updateSyncButtonWidth();
  }, [syncLabel]);

  if (status === "Loading") {
    return null;
  }

  return (
    <div className="px-4 pb-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-end gap-3">
        {showRollback ? (
          <Button
            variant="destructive"
            onClick={handleRollback}
            disabled={isRollingBack || isSyncing}
            className={`ui-soft-in ${
              isRollingBack
                ? "deployment-action-muted opacity-100"
                : ""
            }`}
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Rollback
          </Button>
        ) : null}
        <Button
          ref={syncButtonRef}
          onClick={handleSync}
          disabled={isDeploying}
          className={`transition-[width,background-color,color] duration-200 ${
            isDeploying
              ? "deployment-action-muted opacity-100"
              : ""
          }`}
          style={{ width: `${syncButtonWidth}px` }}
        >
          <span className="inline-flex items-center justify-center gap-2 leading-none">
            <Play
              className={`h-4 w-4 shrink-0 ${
                isDeploying ? "animate-spin" : ""
              }`}
            />
            <span className="leading-none">{syncLabel}</span>
          </span>
        </Button>
      </div>
    </div>
  );
}
