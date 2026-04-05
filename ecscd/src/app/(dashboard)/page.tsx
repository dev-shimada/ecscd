import { ApplicationDashboard } from "@/components/application-dashboard";
import { getDashboardConfigs, getDashboardFilters } from "@/lib/server/dashboard";

export default async function DashboardIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
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
