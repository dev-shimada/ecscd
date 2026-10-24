import fs from "fs";
import os from "os";
import path from "path";
import sqlite3 from "sqlite3";
import { ApplicationDomain } from "../../domain/application";
import { SQLite } from "../sqlite";

function createTestApplication(): ApplicationDomain {
  const now = new Date("2026-04-08T00:00:00.000Z");

  return {
    name: "test-app",
    gitConfig: { repo: "https://github.com/test/repo", branch: "main", path: "task-definition.json" },
    ecsConfig: { cluster: "test-cluster", service: "test-service" },
    awsConfig: { region: "us-east-1", externalId: "test-external-id" },
    createdAt: now,
    updatedAt: now,
  };
}

describe("SQLite", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecscd-sqlite-"));
    dbPath = path.join(dir, "ecscd.db");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("新規 DB でも初期化直後の SELECT が失敗しない (テーブル作成が先に走る)", async () => {
    const db = new SQLite(dbPath);

    await expect(db.getApplications()).resolves.toEqual([]);
    await expect(db.getFilters()).resolves.toEqual([]);
  });

  it("最終 Sync 時刻を永続化して読み戻せる", async () => {
    const db = new SQLite(dbPath);
    const app = createTestApplication();
    await db.createApplication(app);
    expect((await db.getApplications())[0].lastSyncedAt).toBeUndefined();

    const syncedAt = new Date("2026-04-09T12:34:56.000Z");
    await db.updateLastSyncedAt(app.name, syncedAt);

    expect((await db.getApplications())[0].lastSyncedAt).toEqual(syncedAt);
  });

  it("last_synced_at カラムが無い旧 DB を自動でマイグレーションする", async () => {
    await new Promise<void>((resolve, reject) => {
      const legacy = new sqlite3.Database(dbPath);
      legacy.serialize(() => {
        legacy.run(
          `CREATE TABLE applications (
            name TEXT PRIMARY KEY,
            git_repo TEXT NOT NULL,
            git_branch TEXT NOT NULL,
            git_path TEXT NOT NULL,
            ecs_cluster TEXT NOT NULL,
            ecs_service TEXT NOT NULL,
            aws_region TEXT,
            aws_role_arn TEXT,
            aws_external_id TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
          )`,
        );
        legacy.run(
          `INSERT INTO applications VALUES ('legacy-app','https://github.com/test/repo','main','task-definition.json','c','s','us-east-1',NULL,'ext','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')`,
        );
        legacy.close((err) => (err ? reject(err) : resolve()));
      });
    });

    const db = new SQLite(dbPath);
    const apps = await db.getApplications();
    expect(apps.map((a) => a.name)).toEqual(["legacy-app"]);
    expect(apps[0].lastSyncedAt).toBeUndefined();

    const syncedAt = new Date("2026-04-09T00:00:00.000Z");
    await db.updateLastSyncedAt("legacy-app", syncedAt);
    expect((await db.getApplications())[0].lastSyncedAt).toEqual(syncedAt);
  });
});
