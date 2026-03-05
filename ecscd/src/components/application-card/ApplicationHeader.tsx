import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch } from "lucide-react";
import { ApplicationDomain } from "@/lib/domain/application";
import {
  getSyncStatusColor,
  getServiceStatusColor,
} from "@/lib/utils/application";

interface ApplicationHeaderProps {
  application: ApplicationDomain;
}

export function ApplicationHeader({ application }: ApplicationHeaderProps) {
  return (
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
  );
}
