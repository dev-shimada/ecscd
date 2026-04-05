import { ApplicationDashboard } from "@/components/application-dashboard";
import { getDashboardConfigs, getDashboardFilters } from "@/lib/server/dashboard";

export default async function DashboardApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const [{ name }, { filter }, applications, filters] = await Promise.all([
    params,
    searchParams,
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
