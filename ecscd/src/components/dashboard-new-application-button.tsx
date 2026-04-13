"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { NewApplicationDialog } from "@/components/new-application-dialog";

export function DashboardNewApplicationButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full text-left rounded-md px-3 py-2 transition-colors bg-transparent text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
      >
        <div className="flex items-center gap-2 font-medium">
          <Plus className="h-4 w-4" />
          New Application
        </div>
      </button>
      <NewApplicationDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
