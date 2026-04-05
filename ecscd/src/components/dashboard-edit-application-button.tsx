"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditApplicationDialog } from "@/components/edit-application-dialog";
import { ApplicationDomain } from "@/lib/domain/application";

export function DashboardEditApplicationButton({
  application,
  onApplicationChanged,
}: {
  application: ApplicationDomain;
  onApplicationChanged: (name: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const homeHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/?${query}` : "/";
  }, [searchParams]);

  const handleDelete = async (applicationName: string) => {
    const response = await fetch(`/api/apps/${encodeURIComponent(applicationName)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Delete failed");
    }

    if (pathname === `/apps/${encodeURIComponent(applicationName)}`) {
      router.replace(homeHref, { scroll: false });
      return;
    }

    onApplicationChanged(applicationName);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        className="h-7 w-7 shrink-0 text-zinc-600 hover:text-zinc-900"
      >
        <Edit className="h-3.5 w-3.5" />
      </Button>
      <EditApplicationDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        application={application}
        onSuccess={() => onApplicationChanged(application.name)}
        onDelete={handleDelete}
      />
    </>
  );
}
