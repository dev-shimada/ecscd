import { useState } from "react";

interface UseApplicationActionsOptions {
  applicationName: string | null;
  onSync?: (name: string) => void;
  onDelete?: (name: string) => void;
  onRollback?: (name: string) => void;
}

export function useApplicationActions({
  applicationName,
  onSync,
  onDelete,
  onRollback,
}: UseApplicationActionsOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSync = () => {
    if (!applicationName) return;
    setIsLoading(true);
    onSync?.(applicationName);
  };

  const handleDelete = () => {
    if (!applicationName) return;
    setShowDeleteConfirm(false);
    onDelete?.(applicationName);
  };

  const handleRollback = () => {
    if (!applicationName) return;
    setIsLoading(true);
    onRollback?.(applicationName);
  };

  return {
    isLoading,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleSync,
    handleDelete,
    handleRollback,
  };
}
