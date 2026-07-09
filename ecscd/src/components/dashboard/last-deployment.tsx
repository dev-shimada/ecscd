"use client";

import {
  ObservedApplicationDomain,
  getApplicationCurrentDeployment,
} from "@/lib/domain/application";
import { formatRelativeTime } from "@/components/dashboard/format";
import { ExternalLink, RefreshCw } from "lucide-react";

function formatDeploymentState(state: string) {
  switch (state) {
    case "IN_PROGRESS":
      return "In Progress";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    default:
      return state;
  }
}

function getDeploymentStateClass(state: string) {
  switch (state) {
    case "IN_PROGRESS":
      return "text-yellow-600 dark:text-yellow-400";
    case "FAILED":
      return "text-red-600 dark:text-red-400";
    case "COMPLETED":
      return "text-green-600 dark:text-green-400";
    default:
      return "text-muted-foreground";
  }
}

function DashboardTaskGauge({
  runningCount,
  desiredCount,
  isDeploying,
}: {
  runningCount: number;
  desiredCount: number;
  isDeploying: boolean;
}) {
  const roomCount = Math.max(runningCount, desiredCount, 1);

  return (
    <div className="flex items-center gap-2">
      <div
        className="grid h-4 min-w-0 flex-1 gap-1"
        style={{
          gridTemplateColumns: `repeat(${roomCount}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: roomCount }).map((_, index) => {
          const isFilled = index < runningCount;
          const isExtraDeployingTask = isDeploying && index >= desiredCount;
          return (
            <div
              key={index}
              className={`rounded-[3px] border transition-colors ${
                isFilled
                  ? isExtraDeployingTask
                    ? "border-blue-500 bg-blue-500"
                    : "border-green-500 bg-green-500"
                  : "border-border bg-transparent"
              }`}
            />
          );
        })}
      </div>
      <div className="shrink-0 font-medium text-foreground">
        {runningCount}/{desiredCount}
      </div>
    </div>
  );
}

export function DashboardLastDeployment({
  application,
  deploymentUrl,
}: {
  application: ObservedApplicationDomain;
  deploymentUrl: string;
}) {
  const deployment = getApplicationCurrentDeployment(application);
  if (!deployment || application.service.status !== "Success") {
    return null;
  }

  const service = application.service.value;
  const isDeploying = deployment.rolloutState === "IN_PROGRESS";
  const stateClass = getDeploymentStateClass(deployment.rolloutState);

  return (
    <section className="w-full">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Last Deployment</h2>
        <a
          href={deploymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-foreground hover:underline"
        >
          View in AWS Console
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
        <div>
          <div className="text-muted-foreground mb-1">Rollout</div>
          <div className={`inline-flex items-center gap-2 font-medium ${stateClass}`}>
            {isDeploying ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {formatDeploymentState(deployment.rolloutState)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Tasks</div>
          <DashboardTaskGauge
            runningCount={service.runningCount}
            desiredCount={service.desiredCount}
            isDeploying={isDeploying}
          />
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Started</div>
          <div className="font-medium text-foreground">
            {formatRelativeTime(deployment.createdAt)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Last Updated</div>
          <div className="font-medium text-foreground">
            {formatRelativeTime(deployment.updatedAt)}
          </div>
        </div>
      </div>
      {deployment.rolloutStateReason ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {deployment.rolloutStateReason}
        </p>
      ) : null}
    </section>
  );
}
