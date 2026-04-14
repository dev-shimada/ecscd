import { ApplicationDashboard } from "@/components/dashboard/application-dashboard";
import { getDashboardConfigs, getDashboardFilters } from "@/lib/server/dashboard";

export default async function DashboardIndexPage() {
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
