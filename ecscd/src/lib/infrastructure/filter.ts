import { FilterRepository } from "../repository/filter";
import { FilterDomain } from "../domain/filter";
import { IDatabase } from "./interface/database";

export class Filter implements FilterRepository {
  private db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  async getFilters(): Promise<FilterDomain[]> {
    return this.db.getFilters();
  }

  async getFilterById(id: string): Promise<FilterDomain | null> {
    return this.db.getFilterById(id);
  }

  async createFilter(filter: FilterDomain): Promise<void> {
    await this.db.createFilter(filter);
  }

  async deleteFilter(id: string): Promise<void> {
    await this.db.deleteFilter(id);
  }
}
