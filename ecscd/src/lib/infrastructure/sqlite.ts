import sqlite3 from "sqlite3";
import { IDatabase } from "./interface/database";
import { Database } from "sqlite3";
import { ApplicationDomain } from "../domain/application";
import * as fs from "fs";
import * as path from "path";

interface ApplicationsModel {
  name: string;
  git_repo: string;
  git_branch: string;
  git_path: string;
  ecs_cluster: string;
  ecs_service: string;
  aws_region: string;
  aws_role_arn: string;
  aws_external_id: string;
  created_at: string;
  updated_at: string;
}

export class SQLite implements IDatabase {
  private db: Database;
  constructor(dbPath: string) {
    // Ensure directory exists before creating database
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath);
    this.initializeDatabase();
  }
  private async initializeDatabase(): Promise<void> {
    // Initialize SQLite database connection and create tables if they don't exist
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(
          `
            CREATE TABLE IF NOT EXISTS applications (
                name TEXT PRIMARY KEY,
                git_repo TEXT NOT NULL,
                git_branch TEXT NOT NULL,
                git_path TEXT NOT NULL,
                ecs_cluster TEXT NOT NULL,
                ecs_service TEXT NOT NULL,
                aws_region TEXT NOT NULL,
                aws_role_arn TEXT,
                aws_external_id TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )`,
          (err: Error | null) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    });
  }
  async getApplications(): Promise<ApplicationDomain[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM applications ORDER BY created_at DESC`,
        async (err: Error | null, rows: ApplicationsModel[]) => {
          if (err) {
            return reject(err);
          }
          const applications: ApplicationDomain[] = await Promise.all(
            rows.map((row) => this.mapRowToApplication(row))
          );
          resolve(applications);
        }
      );
    });
  }

  async getApplicationNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT name FROM applications ORDER BY created_at DESC`,
        (err: Error | null, rows: { name: string }[]) => {
          if (err) {
            return reject(err);
          }
          resolve(rows.map((row) => row.name));
        }
      );
    });
  }

  async createApplication(application: ApplicationDomain): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO applications (
            name,
            git_repo,
            git_branch,
            git_path,
            ecs_cluster,
            ecs_service,
            aws_region,
            aws_role_arn,
            aws_external_id,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          application.name,
          application.gitConfig.repo,
          application.gitConfig.branch,
          application.gitConfig.path,
          application.ecsConfig.cluster,
          application.ecsConfig.service,
          application.awsConfig.region,
          application.awsConfig.roleArn,
          application.awsConfig.externalId,
          application.createdAt,
          application.updatedAt,
        ],
        (err: Error | null) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }
  async updateApplication(application: ApplicationDomain): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE applications SET
            git_repo = ?,
            git_branch = ?,
            git_path = ?,
            ecs_cluster = ?,
            ecs_service = ?,
            aws_region = ?,
            aws_role_arn = ?,
            updated_at = ?
          WHERE name = ?`,
        [
          application.gitConfig.repo,
          application.gitConfig.branch,
          application.gitConfig.path,
          application.ecsConfig.cluster,
          application.ecsConfig.service,
          application.awsConfig.region,
          application.awsConfig.roleArn,
          application.updatedAt,
          application.name,
        ],
        (err: Error | null) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }
  async deleteApplication(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM applications WHERE name = ?`,
        [name],
        (err: Error | null) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }
  private async mapRowToApplication(
    row: ApplicationsModel
  ): Promise<ApplicationDomain> {
    return {
      name: row.name,
      sync: { status: "InSync" },
      gitConfig: {
        repo: row.git_repo,
        branch: row.git_branch,
        path: row.git_path,
      },
      ecsConfig: {
        cluster: row.ecs_cluster,
        service: row.ecs_service,
      },
      awsConfig: {
        region: row.aws_region,
        roleArn: row.aws_role_arn,
        externalId: row.aws_external_id,
      },
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
