import { Suspense } from "react";

// (dashboard) 配下のページは全て ApplicationDashboard をレンダリングするため、
// キャッシュ設定 (force-dynamic) と Suspense 境界をここに一元化する。
// 個々の page.tsx に重複して書くと、片方だけ更新漏れが起きて Full Route Cache に
// 古い一覧・フィルタが残り続けるおそれがある。
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
