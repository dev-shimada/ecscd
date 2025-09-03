import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseRepository } from './base';
import {
  DatabaseApplication,
  DatabaseDeployment,
  DatabaseDeploymentEvent,
  DatabaseSyncStatus,
  DatabaseApplicationStatus
} from '@/types/database';

export class SQLiteRepository implements DatabaseRepository {
  private db: Database;
  private dbPath: string;

  constructor(dbPath: string = './ecscd.db') {
    this.dbPath = dbPath;
    this.db = new sqlite3.Database(dbPath);
    this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS applications (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            git_owner TEXT NOT NULL,
            git_repo TEXT NOT NULL,
            git_branch TEXT,
            git_path TEXT,
            git_token TEXT,
            ecs_cluster TEXT NOT NULL,
            ecs_service TEXT NOT NULL,
            task_definition_path TEXT NOT NULL,
            auto_sync BOOLEAN DEFAULT FALSE,
            sync_policy_automated BOOLEAN DEFAULT FALSE,
            sync_policy_self_heal BOOLEAN DEFAULT FALSE,
            sync_policy_prune BOOLEAN DEFAULT FALSE,
            aws_region TEXT,
            aws_role_arn TEXT,
            aws_external_id TEXT,
            aws_session_name TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS deployments (
            id TEXT PRIMARY KEY,
            application_id TEXT NOT NULL,
            status TEXT NOT NULL,
            message TEXT NOT NULL,
            started_at DATETIME NOT NULL,
            finished_at DATETIME,
            progress_current INTEGER NOT NULL,
            progress_total INTEGER NOT NULL,
            progress_message TEXT NOT NULL,
            task_definition_arn TEXT,
            revision TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS deployment_events (
            id TEXT PRIMARY KEY,
            deployment_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (deployment_id) REFERENCES deployments(id) ON DELETE CASCADE
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS sync_status (
            id TEXT PRIMARY KEY,
            application_id TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL,
            revision TEXT NOT NULL,
            last_synced_at DATETIME,
            message TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS application_status (
            id TEXT PRIMARY KEY,
            application_id TEXT UNIQUE NOT NULL,
            health TEXT NOT NULL,
            operation_phase TEXT,
            operation_message TEXT,
            operation_started_at DATETIME,
            operation_finished_at DATETIME,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async createApplication(application: Omit<DatabaseApplication, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseApplication> {
    const now = new Date();
    const dbApplication: DatabaseApplication = {
      ...application,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO applications (
          id, name, git_owner, git_repo, git_branch, git_path, git_token,
          ecs_cluster, ecs_service, task_definition_path, auto_sync,
          sync_policy_automated, sync_policy_self_heal, sync_policy_prune,
          aws_region, aws_role_arn, aws_external_id, aws_session_name,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dbApplication.id,
        dbApplication.name,
        dbApplication.gitRepository.owner,
        dbApplication.gitRepository.repo,
        dbApplication.gitRepository.branch,
        dbApplication.gitRepository.path,
        dbApplication.gitRepository.token,
        dbApplication.ecsCluster,
        dbApplication.ecsService,
        dbApplication.taskDefinitionPath,
        dbApplication.autoSync ? 1 : 0,
        dbApplication.syncPolicy?.automated ? 1 : 0,
        dbApplication.syncPolicy?.selfHeal ? 1 : 0,
        dbApplication.syncPolicy?.prune ? 1 : 0,
        dbApplication.awsConfig?.region,
        dbApplication.awsConfig?.roleArn,
        dbApplication.awsConfig?.externalId,
        dbApplication.awsConfig?.sessionName,
        dbApplication.createdAt.toISOString(),
        dbApplication.updatedAt.toISOString()
      ], function(err) {
        if (err) reject(err);
        else resolve(dbApplication);
      });
    });
  }

  async getApplication(id: string): Promise<DatabaseApplication | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM applications WHERE id = ?
      `, [id], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToApplication(row));
      });
    });
  }

  async getApplicationByName(name: string): Promise<DatabaseApplication | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM applications WHERE name = ?
      `, [name], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToApplication(row));
      });
    });
  }

  async getAllApplications(): Promise<DatabaseApplication[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM applications ORDER BY created_at DESC
      `, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToApplication(row)));
      });
    });
  }

  async updateApplication(id: string, updates: Partial<DatabaseApplication>): Promise<DatabaseApplication | null> {
    const existing = await this.getApplication(id);
    if (!existing) return null;

    const updatedApp = { ...existing, ...updates, updatedAt: new Date() };

    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE applications SET
          name = ?, git_owner = ?, git_repo = ?, git_branch = ?, git_path = ?, git_token = ?,
          ecs_cluster = ?, ecs_service = ?, task_definition_path = ?, auto_sync = ?,
          sync_policy_automated = ?, sync_policy_self_heal = ?, sync_policy_prune = ?,
          aws_region = ?, aws_role_arn = ?, aws_external_id = ?, aws_session_name = ?,
          updated_at = ?
        WHERE id = ?
      `, [
        updatedApp.name,
        updatedApp.gitRepository.owner,
        updatedApp.gitRepository.repo,
        updatedApp.gitRepository.branch,
        updatedApp.gitRepository.path,
        updatedApp.gitRepository.token,
        updatedApp.ecsCluster,
        updatedApp.ecsService,
        updatedApp.taskDefinitionPath,
        updatedApp.autoSync ? 1 : 0,
        updatedApp.syncPolicy?.automated ? 1 : 0,
        updatedApp.syncPolicy?.selfHeal ? 1 : 0,
        updatedApp.syncPolicy?.prune ? 1 : 0,
        updatedApp.awsConfig?.region,
        updatedApp.awsConfig?.roleArn,
        updatedApp.awsConfig?.externalId,
        updatedApp.awsConfig?.sessionName,
        updatedApp.updatedAt.toISOString(),
        id
      ], function(err) {
        if (err) reject(err);
        else resolve(updatedApp);
      });
    });
  }

  async deleteApplication(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM applications WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  async createDeployment(deployment: Omit<DatabaseDeployment, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseDeployment> {
    const now = new Date();
    const dbDeployment: DatabaseDeployment = {
      ...deployment,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO deployments (
          id, application_id, status, message, started_at, finished_at,
          progress_current, progress_total, progress_message,
          task_definition_arn, revision, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dbDeployment.id,
        dbDeployment.applicationId,
        dbDeployment.status,
        dbDeployment.message,
        dbDeployment.startedAt.toISOString(),
        dbDeployment.finishedAt?.toISOString(),
        dbDeployment.progress.current,
        dbDeployment.progress.total,
        dbDeployment.progress.message,
        dbDeployment.taskDefinitionArn,
        dbDeployment.revision,
        dbDeployment.createdAt.toISOString(),
        dbDeployment.updatedAt.toISOString()
      ], function(err) {
        if (err) reject(err);
        else resolve(dbDeployment);
      });
    });
  }

  async getDeployment(id: string): Promise<DatabaseDeployment | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM deployments WHERE id = ?
      `, [id], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToDeployment(row));
      });
    });
  }

  async getDeploymentsByApplication(applicationId: string): Promise<DatabaseDeployment[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM deployments WHERE application_id = ? ORDER BY created_at DESC
      `, [applicationId], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToDeployment(row)));
      });
    });
  }

  async updateDeployment(id: string, updates: Partial<DatabaseDeployment>): Promise<DatabaseDeployment | null> {
    const existing = await this.getDeployment(id);
    if (!existing) return null;

    const updatedDeployment = { ...existing, ...updates, updatedAt: new Date() };

    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE deployments SET
          status = ?, message = ?, finished_at = ?,
          progress_current = ?, progress_total = ?, progress_message = ?,
          task_definition_arn = ?, revision = ?, updated_at = ?
        WHERE id = ?
      `, [
        updatedDeployment.status,
        updatedDeployment.message,
        updatedDeployment.finishedAt?.toISOString(),
        updatedDeployment.progress.current,
        updatedDeployment.progress.total,
        updatedDeployment.progress.message,
        updatedDeployment.taskDefinitionArn,
        updatedDeployment.revision,
        updatedDeployment.updatedAt.toISOString(),
        id
      ], function(err) {
        if (err) reject(err);
        else resolve(updatedDeployment);
      });
    });
  }

  async deleteDeployment(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM deployments WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  async createDeploymentEvent(event: Omit<DatabaseDeploymentEvent, 'id' | 'createdAt'>): Promise<DatabaseDeploymentEvent> {
    const now = new Date();
    const dbEvent: DatabaseDeploymentEvent = {
      ...event,
      id: uuidv4(),
      createdAt: now
    };

    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO deployment_events (id, deployment_id, timestamp, message, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        dbEvent.id,
        dbEvent.deploymentId,
        dbEvent.timestamp.toISOString(),
        dbEvent.message,
        dbEvent.type,
        dbEvent.createdAt.toISOString()
      ], function(err) {
        if (err) reject(err);
        else resolve(dbEvent);
      });
    });
  }

  async getDeploymentEvents(deploymentId: string): Promise<DatabaseDeploymentEvent[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM deployment_events WHERE deployment_id = ? ORDER BY timestamp ASC
      `, [deploymentId], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToDeploymentEvent(row)));
      });
    });
  }

  async deleteDeploymentEvents(deploymentId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM deployment_events WHERE deployment_id = ?`, [deploymentId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  async createOrUpdateSyncStatus(status: Omit<DatabaseSyncStatus, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseSyncStatus> {
    const existing = await this.getSyncStatus(status.applicationId);
    
    if (existing) {
      const updated = await this.updateSyncStatus(existing.id, status);
      return updated!;
    }

    const now = new Date();
    const dbStatus: DatabaseSyncStatus = {
      ...status,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO sync_status (id, application_id, status, revision, last_synced_at, message, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dbStatus.id,
        dbStatus.applicationId,
        dbStatus.status,
        dbStatus.revision,
        dbStatus.lastSyncedAt?.toISOString(),
        dbStatus.message,
        dbStatus.createdAt.toISOString(),
        dbStatus.updatedAt.toISOString()
      ], function(err) {
        if (err) reject(err);
        else resolve(dbStatus);
      });
    });
  }

  private async updateSyncStatus(id: string, updates: Partial<DatabaseSyncStatus>): Promise<DatabaseSyncStatus | null> {
    const existing = await this.getSyncStatusById(id);
    if (!existing) return null;

    const updatedStatus = { ...existing, ...updates, updatedAt: new Date() };

    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE sync_status SET
          status = ?, revision = ?, last_synced_at = ?, message = ?, updated_at = ?
        WHERE id = ?
      `, [
        updatedStatus.status,
        updatedStatus.revision,
        updatedStatus.lastSyncedAt?.toISOString(),
        updatedStatus.message,
        updatedStatus.updatedAt.toISOString(),
        id
      ], function(err) {
        if (err) reject(err);
        else resolve(updatedStatus);
      });
    });
  }

  private async getSyncStatusById(id: string): Promise<DatabaseSyncStatus | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM sync_status WHERE id = ?
      `, [id], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToSyncStatus(row));
      });
    });
  }

  async getSyncStatus(applicationId: string): Promise<DatabaseSyncStatus | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM sync_status WHERE application_id = ?
      `, [applicationId], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToSyncStatus(row));
      });
    });
  }

  async deleteSyncStatus(applicationId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM sync_status WHERE application_id = ?`, [applicationId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  async createOrUpdateApplicationStatus(status: Omit<DatabaseApplicationStatus, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseApplicationStatus> {
    const existing = await this.getApplicationStatus(status.applicationId);
    
    if (existing) {
      const updated = await this.updateApplicationStatus(existing.id, status);
      return updated!;
    }

    const now = new Date();
    const dbStatus: DatabaseApplicationStatus = {
      ...status,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO application_status (
          id, application_id, health, operation_phase, operation_message,
          operation_started_at, operation_finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dbStatus.id,
        dbStatus.applicationId,
        dbStatus.health,
        dbStatus.operationState?.phase,
        dbStatus.operationState?.message,
        dbStatus.operationState?.startedAt?.toISOString(),
        dbStatus.operationState?.finishedAt?.toISOString(),
        dbStatus.createdAt.toISOString(),
        dbStatus.updatedAt.toISOString()
      ], function(err) {
        if (err) reject(err);
        else resolve(dbStatus);
      });
    });
  }

  private async updateApplicationStatus(id: string, updates: Partial<DatabaseApplicationStatus>): Promise<DatabaseApplicationStatus | null> {
    const existing = await this.getApplicationStatusById(id);
    if (!existing) return null;

    const updatedStatus = { ...existing, ...updates, updatedAt: new Date() };

    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE application_status SET
          health = ?, operation_phase = ?, operation_message = ?,
          operation_started_at = ?, operation_finished_at = ?, updated_at = ?
        WHERE id = ?
      `, [
        updatedStatus.health,
        updatedStatus.operationState?.phase,
        updatedStatus.operationState?.message,
        updatedStatus.operationState?.startedAt?.toISOString(),
        updatedStatus.operationState?.finishedAt?.toISOString(),
        updatedStatus.updatedAt.toISOString(),
        id
      ], function(err) {
        if (err) reject(err);
        else resolve(updatedStatus);
      });
    });
  }

  private async getApplicationStatusById(id: string): Promise<DatabaseApplicationStatus | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM application_status WHERE id = ?
      `, [id], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToApplicationStatus(row));
      });
    });
  }

  async getApplicationStatus(applicationId: string): Promise<DatabaseApplicationStatus | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM application_status WHERE application_id = ?
      `, [applicationId], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToApplicationStatus(row));
      });
    });
  }

  async deleteApplicationStatus(applicationId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM application_status WHERE application_id = ?`, [applicationId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      this.db.get('SELECT 1', (err) => {
        resolve(!err);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private mapRowToApplication(row: any): DatabaseApplication {
    return {
      id: row.id,
      name: row.name,
      gitRepository: {
        owner: row.git_owner,
        repo: row.git_repo,
        branch: row.git_branch,
        path: row.git_path,
        token: row.git_token
      },
      ecsCluster: row.ecs_cluster,
      ecsService: row.ecs_service,
      taskDefinitionPath: row.task_definition_path,
      autoSync: Boolean(row.auto_sync),
      syncPolicy: {
        automated: Boolean(row.sync_policy_automated),
        selfHeal: Boolean(row.sync_policy_self_heal),
        prune: Boolean(row.sync_policy_prune)
      },
      awsConfig: (row.aws_region || row.aws_role_arn || row.aws_external_id || row.aws_session_name) ? {
        region: row.aws_region,
        roleArn: row.aws_role_arn,
        externalId: row.aws_external_id,
        sessionName: row.aws_session_name
      } : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToDeployment(row: any): DatabaseDeployment {
    return {
      id: row.id,
      applicationId: row.application_id,
      status: row.status,
      message: row.message,
      startedAt: new Date(row.started_at),
      finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
      progress: {
        current: row.progress_current,
        total: row.progress_total,
        message: row.progress_message
      },
      taskDefinitionArn: row.task_definition_arn,
      revision: row.revision,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToDeploymentEvent(row: any): DatabaseDeploymentEvent {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      timestamp: new Date(row.timestamp),
      message: row.message,
      type: row.type,
      createdAt: new Date(row.created_at)
    };
  }

  private mapRowToSyncStatus(row: any): DatabaseSyncStatus {
    return {
      id: row.id,
      applicationId: row.application_id,
      status: row.status,
      revision: row.revision,
      lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
      message: row.message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToApplicationStatus(row: any): DatabaseApplicationStatus {
    return {
      id: row.id,
      applicationId: row.application_id,
      health: row.health,
      operationState: row.operation_phase ? {
        phase: row.operation_phase,
        message: row.operation_message,
        startedAt: row.operation_started_at ? new Date(row.operation_started_at) : undefined,
        finishedAt: row.operation_finished_at ? new Date(row.operation_finished_at) : undefined
      } : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}