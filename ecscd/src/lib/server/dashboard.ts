import { au, fu } from "@/lib/di";
import {
  ApplicationDomain,
  DiffDomain,
  getApplicationReason,
} from "@/lib/domain/application";
import { FilterDomain } from "@/lib/domain/filter";
import { cache } from "react";

export type ApplicationDiffResource = {
  diffs: DiffDomain[];
  error?: string;
  summary: string;
};

function applyNameFilter(
  applications: ApplicationDomain[],
  filterPattern?: string,
) {
  if (!filterPattern?.trim()) {
    return applications;
  }

  const normalizedFilter = filterPattern.trim().toLowerCase();
  return applications.filter((application) =>
    application.name.toLowerCase().includes(normalizedFilter),
  );
}

export const getDashboardFilters = cache(async (): Promise<FilterDomain[]> => {
  return fu.getFilters();
});

export const getDashboardConfigs = cache(
  async (filterPattern = ""): Promise<ApplicationDomain[]> => {
    const applications = await au.getApplicationConfigs();
    return applyNameFilter(applications, filterPattern);
  },
);

export const getDashboardApplicationConfig = cache(
  async (name: string): Promise<ApplicationDomain | null> => {
    return au.getApplicationConfig(name);
  },
);

export const getDashboardApplication = cache(
  async (name: string): Promise<ApplicationDomain | null> => {
    return au.getApplication(name);
  },
);

export const getDashboardApplicationDiff = cache(
  async (name: string): Promise<ApplicationDiffResource | null> => {
    const application = await getDashboardApplication(name);
    if (!application) {
      return null;
    }

    const diffs = application.diff.status === "Success" ? application.diff.value : [];

    if (
      application.sync.status === "Error" ||
      application.diff.status === "Error"
    ) {
      return {
        diffs,
        error:
          getApplicationReason(application) ||
          "Failed to load configuration diff.",
        summary: `${diffs.length} changes`,
      };
    }

    return {
      diffs,
      summary: `${diffs.length} changes`,
    };
  },
);
