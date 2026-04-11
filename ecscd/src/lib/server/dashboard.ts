import { au, fu } from "@/lib/di";
import { ApplicationDomain } from "@/lib/domain/application";
import { FilterDomain } from "@/lib/domain/filter";
import { cache } from "react";

export const getDashboardFilters = cache(async (): Promise<FilterDomain[]> => {
  return fu.getFilters();
});

export const getDashboardConfigs = cache(async (): Promise<ApplicationDomain[]> => {
  return au.getApplications();
});
