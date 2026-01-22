import { ApplicationDomain } from "../../domain/application";
import { FilterDomain } from "../../domain/filter";

export interface IDatabase {
  getApplications(): Promise<ApplicationDomain[]>;
  getApplicationNames(): Promise<string[]>;
  createApplication(application: ApplicationDomain): Promise<void>;
  updateApplication(application: ApplicationDomain): Promise<void>;
  deleteApplication(name: string): Promise<void>;

  getFilters(): Promise<FilterDomain[]>;
  getFilterById(id: string): Promise<FilterDomain | null>;
  createFilter(filter: FilterDomain): Promise<void>;
  deleteFilter(id: string): Promise<void>;
}
