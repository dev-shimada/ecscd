import { CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, ExternalLink, Edit, Trash2, Undo2 } from "lucide-react";

interface ApplicationActionsProps {
  applicationName: string;
  isLoading: boolean;
  hasActiveDeployment: boolean;
  hasRollbackDeployment: boolean;
  onSync: () => void;
  onViewDiff?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRollback?: () => void;
  onShowDeleteConfirm: () => void;
}

export function ApplicationActions({
  applicationName,
  isLoading,
  hasActiveDeployment,
  hasRollbackDeployment,
  onSync,
  onViewDiff,
  onEdit,
  onDelete,
  onRollback,
  onShowDeleteConfirm,
}: ApplicationActionsProps) {
  return (
    <CardFooter className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onViewDiff?.()}
        className="flex items-center gap-2"
      >
        <ExternalLink className="h-4 w-4" />
        View Diff
      </Button>

      <Button
        size="sm"
        onClick={onSync}
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
          onClick={() => onEdit()}
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
          onClick={onShowDeleteConfirm}
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
          onClick={() => onRollback()}
          disabled={isLoading || hasRollbackDeployment}
          className="flex items-center gap-2"
        >
          <Undo2 className="h-4 w-4" />
          Rollback
        </Button>
      )}
    </CardFooter>
  );
}
