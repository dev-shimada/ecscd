/**
 * DynamoDB リポジトリ実装を ministack の DynamoDB に対して検証する統合テスト。
 * テスト対象 (src/lib/infrastructure/dynamodb.ts) は endpoint を明示しないため、
 * AWS_ENDPOINT_URL 環境変数の解決を含めて本番同等の経路を通る。
 */
import { describe, beforeAll, expect, it } from "@jest/globals";
import { DynamoDB } from "../../src/lib/infrastructure/dynamodb";
import { FilterDomain } from "../../src/lib/domain/filter";
import {
  REGION,
  buildApplication,
  createApplicationsTable,
  rawDynamoDbClient,
  uniqueName,
  waitForMinistack,
} from "./helpers";

describe("DynamoDB repository (ministack)", () => {
  const tableName = uniqueName("ecscd-it");
  let db: DynamoDB;

  beforeAll(async () => {
    await waitForMinistack();
    await createApplicationsTable(rawDynamoDbClient(), tableName);
    db = new DynamoDB(REGION, tableName);
  });

  it("creates and lists an application", async () => {
    const app = buildApplication({
      name: uniqueName("app"),
      cluster: "c1",
      service: "s1",
    });

    await db.createApplication(app);

    const applications = await db.getApplications();
    const found = applications.find((a) => a.name === app.name);
    expect(found).toBeDefined();
    expect(found?.gitConfig).toEqual(app.gitConfig);
    expect(found?.ecsConfig).toEqual(app.ecsConfig);

    const names = await db.getApplicationNames();
    expect(names).toContain(app.name);
  });

  it("updates an application", async () => {
    const app = buildApplication({
      name: uniqueName("app"),
      cluster: "c1",
      service: "s1",
    });
    await db.createApplication(app);

    await db.updateApplication({
      ...app,
      gitConfig: { ...app.gitConfig, branch: "develop" },
      updatedAt: new Date(),
    });

    const applications = await db.getApplications();
    const found = applications.find((a) => a.name === app.name);
    expect(found?.gitConfig.branch).toBe("develop");
  });

  it("deletes an application", async () => {
    const app = buildApplication({
      name: uniqueName("app"),
      cluster: "c1",
      service: "s1",
    });
    await db.createApplication(app);

    await db.deleteApplication(app.name);

    const names = await db.getApplicationNames();
    expect(names).not.toContain(app.name);
  });

  it("rejects duplicate application names", async () => {
    const app = buildApplication({
      name: uniqueName("app"),
      cluster: "c1",
      service: "s1",
    });
    await db.createApplication(app);

    await expect(db.createApplication(app)).rejects.toThrow(/already exists/);
  });

  it("filters CRUD round-trip", async () => {
    const now = new Date();
    const filter: FilterDomain = {
      id: uniqueName("filter"),
      name: "backend services",
      pattern: "backend",
      createdAt: now,
      updatedAt: now,
    };

    await db.createFilter(filter);

    const filters = await db.getFilters();
    const found = filters.find((f) => f.id === filter.id);
    expect(found?.name).toBe(filter.name);
    expect(found?.pattern).toBe(filter.pattern);

    const byId = await db.getFilterById(filter.id);
    expect(byId?.pattern).toBe(filter.pattern);

    await db.deleteFilter(filter.id);
    expect(await db.getFilterById(filter.id)).toBeNull();
  });

  it("filter items do not leak into application listings", async () => {
    const now = new Date();
    const filter: FilterDomain = {
      id: uniqueName("filter"),
      name: "leak-check",
      pattern: "x",
      createdAt: now,
      updatedAt: now,
    };
    await db.createFilter(filter);

    const names = await db.getApplicationNames();
    expect(names.find((n) => n.startsWith("filter#"))).toBeUndefined();
  });
});
