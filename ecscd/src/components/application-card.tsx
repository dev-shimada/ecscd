"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ApplicationDomain } from "@/lib/domain/application";
import { useApplication } from "@/hooks/useApplication";
import { useApplicationActions } from "@/hooks/useApplicationActions";
import {
  ApplicationHeader,
  ApplicationDetails,
  DeploymentStatus,
  ApplicationActions,
  DeleteConfirmDialog,
  LoadingCard,
  ErrorCard,
} from "./application-card/";

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
  // カスタムフックでデータ管理
  const {
    application,
    isLoading: isLoadingData,
    hasActiveDeployment,
    hasRollbackDeployment,
  } = useApplication({
    appName,
    isDeploymentActive,
    onDataLoaded,
  });

  // カスタムフックでアクション管理
  const actions = useApplicationActions({
    applicationName: application?.name || null,
    onSync,
    onDelete,
    onRollback,
  });

  // ローディング状態
  if (isLoadingData) {
    return <LoadingCard appName={appName} />;
  }

  // エラー状態（アプリケーションが見つからない）
  if (!application) {
    return <ErrorCard appName={appName} />;
  }

  return (
    <Card className="w-full">
      <ApplicationHeader application={application} />

      <CardContent>
        <ApplicationDetails application={application} />

        {application.service?.deployments.some((d) => d.status === "PRIMARY") && (
          <DeploymentStatus
            application={application}
            hasActiveDeployment={hasActiveDeployment}
          />
        )}
      </CardContent>

      <ApplicationActions
        applicationName={application.name}
        isLoading={actions.isLoading}
        hasActiveDeployment={hasActiveDeployment}
        hasRollbackDeployment={hasRollbackDeployment}
        onSync={actions.handleSync}
        onViewDiff={() => onViewDiff?.(application.name)}
        onEdit={onEdit ? () => onEdit(application.name) : undefined}
        onDelete={onDelete ? actions.handleDelete : undefined}
        onRollback={onRollback ? actions.handleRollback : undefined}
        onShowDeleteConfirm={() => actions.setShowDeleteConfirm(true)}
      />

      <DeleteConfirmDialog
        isOpen={actions.showDeleteConfirm}
        applicationName={application.name}
        onConfirm={actions.handleDelete}
        onCancel={() => actions.setShowDeleteConfirm(false)}
      />
    </Card>
  );
}
