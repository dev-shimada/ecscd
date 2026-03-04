import { Clock } from "lucide-react";
import { ApplicationDomain } from "@/lib/domain/application";
import {
  formatLastSyncTime,
  extractRevisionFromArn,
} from "@/lib/utils/application";

interface ApplicationDetailsProps {
  application: ApplicationDomain;
}

export function ApplicationDetails({ application }: ApplicationDetailsProps) {
  return (
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
    </div>
  );
}
