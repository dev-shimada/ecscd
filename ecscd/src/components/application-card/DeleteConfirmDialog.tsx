import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  applicationName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  isOpen,
  applicationName,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-2">Delete Application</h3>
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete &quot;{applicationName}&quot;? This
          action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
