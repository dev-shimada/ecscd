"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditApplicationDialog } from "@/components/application/edit-application-dialog";
import { ApplicationDomain } from "@/lib/domain/application";

export function DashboardEditApplicationButton({
  application,
  onApplicationChanged,
  onApplicationDeleted,
}: {
  application: ApplicationDomain;
  onApplicationChanged: (name: string) => void;
  onApplicationDeleted: (name: string) => void;
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

    onApplicationDeleted(applicationName);

    if (pathname === `/apps/${encodeURIComponent(applicationName)}`) {
      router.replace(homeHref, { scroll: false });
    }
  };

  // FIXME(review): main の application-card は Edit/Delete をアクティブデプロイ中
  // disabled={isLoading || hasActiveDeployment} で無効化していたが、その代替が無く、
  // ロールアウト進行中にアプリ設定の削除・変更ができてしまう(進行中デプロイの
  // 監視・ロールバックが UI から不可能になる)。
  // 修正例: hasActiveDeployment を props で受け取り
  //   <Button disabled={hasActiveDeployment} ...>
  // とし、EditApplicationDialog の Delete ボタンにも渡して無効化する。
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
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
