import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink } from "lucide-react";
import { ServiceDomain } from "@/lib/domain/application";
import {
  getDeploymentStatusColor,
  getRolloutStateColor,
  formatLastSyncTime,
  getEcsConsoleUrl,
} from "@/lib/utils/application";
import { ApplicationDomain } from "@/lib/domain/application";

interface DeploymentStatusProps {
  application: ApplicationDomain;
  hasActiveDeployment: boolean;
}

export function DeploymentStatus({
  application,
  hasActiveDeployment,
}: DeploymentStatusProps) {
  const service = application.service;
  const primaryDeployment = service?.deployments.find(
    (d) => d.status === "PRIMARY"
  );

  if (!primaryDeployment) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-600">
        Latest Deployment
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Status:</span>
          <Badge
            variant={getDeploymentStatusColor(primaryDeployment.status)}
            className="ml-2"
          >
            {primaryDeployment.status}
          </Badge>
        </div>
        <div>
          <span className="text-gray-500">Tasks:</span>
          <span className="ml-2 font-mono">
            {service?.runningCount}/{service?.desiredCount}
          </span>
        </div>
      </div>

      <div className="text-sm">
        <span className="text-gray-500">Rollout:</span>
        <Badge
          variant={getRolloutStateColor(primaryDeployment.rolloutState)}
          className="ml-2"
        >
          {primaryDeployment.rolloutState}
        </Badge>
        <div className="text-xs text-gray-500 mt-1">
          {primaryDeployment.rolloutStateReason}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <div>Created: {formatLastSyncTime(primaryDeployment.createdAt)}</div>
        <div>Updated: {formatLastSyncTime(primaryDeployment.updatedAt)}</div>
      </div>

      {hasActiveDeployment && (
        <div className="p-3 bg-gray-100 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="font-medium">
                {primaryDeployment.rolloutState || "Deploying..."}
              </span>
            </div>
            <a
              href={getEcsConsoleUrl(application)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              View in AWS Console
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {primaryDeployment.rolloutStateReason}
          </p>
        </div>
      )}
    </div>
  );
}
