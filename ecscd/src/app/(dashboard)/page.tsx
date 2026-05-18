import { ApplicationDashboard } from "@/components/dashboard/application-dashboard";
import { getDashboardConfigs, getDashboardFilters } from "@/lib/server/dashboard";
import { Suspense } from "react";

export default async function DashboardIndexPage() {
  const [applications, filters] = await Promise.all([
    getDashboardConfigs(),
    getDashboardFilters(),
  ]);

  return (
    <Suspense fallback={null}>
      <ApplicationDashboard
        applications={applications}
        filters={filters}
      />
    </Suspense>
  );
}
