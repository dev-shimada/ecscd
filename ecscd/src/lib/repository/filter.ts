import { FilterDomain } from "../domain/filter";

export interface FilterRepository {
  getFilters(): Promise<FilterDomain[]>;
  getFilterById(id: string): Promise<FilterDomain | null>;
  createFilter(filter: FilterDomain): Promise<void>;
  deleteFilter(id: string): Promise<void>;
}
