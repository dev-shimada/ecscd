import { FilterDomain } from "../domain/filter";
import { FilterRepository } from "../repository/filter";

export interface IFilterUsecase {
  getFilters(): Promise<FilterDomain[]>;
  getFilterById(id: string): Promise<FilterDomain | null>;
  createFilter(name: string, pattern: string): Promise<FilterDomain>;
  deleteFilter(id: string): Promise<void>;
}

export class FilterUsecase implements IFilterUsecase {
  constructor(private filterRepository: FilterRepository) {}

  async getFilters(): Promise<FilterDomain[]> {
    return this.filterRepository.getFilters();
  }

  async getFilterById(id: string): Promise<FilterDomain | null> {
    return this.filterRepository.getFilterById(id);
  }

  async createFilter(name: string, pattern: string): Promise<FilterDomain> {
    const filter: FilterDomain = {
      id: crypto.randomUUID(),
      name,
      pattern,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.filterRepository.createFilter(filter);
    return filter;
  }

  async deleteFilter(id: string): Promise<void> {
    await this.filterRepository.deleteFilter(id);
  }
}
