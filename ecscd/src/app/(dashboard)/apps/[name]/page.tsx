import { ApplicationDashboard } from "@/components/dashboard/application-dashboard";
import { getDashboardConfigs, getDashboardFilters } from "@/lib/server/dashboard";

// FIXME(review): 同じデータ・同じコンポーネントを描画する (dashboard)/page.tsx には
// a03432e で force-dynamic が追加されたが、このルートには無い。本番ビルドでは
// 初回アクセス時の描画が Full Route Cache に残り、以後サイドバーの一覧やフィルタが
// 古いまま配信され得る(作成前に /apps/xxx を踏むと "Application not found" が
// キャッシュされる恐れもある)。修正例:
//   export const dynamic = "force-dynamic";
// より深い解としては、共有の (dashboard)/layout.tsx で一括指定して
// 2 ルートのパッチ重複(Suspense + force-dynamic)を解消する。
export default async function DashboardApplicationPage() {
  const [applications, filters] = await Promise.all([
    getDashboardConfigs(),
    getDashboardFilters(),
  ]);

  return (
    <ApplicationDashboard
      applications={applications}
      filters={filters}
    />
  );
}
