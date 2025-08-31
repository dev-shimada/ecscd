import { DatabaseRepository } from './base';
import { DynamoDBRepository } from './dynamodb';
import { SQLiteRepository } from './sqlite';
import { DatabaseConfig } from '@/types/database';

export class DatabaseFactory {
  private static instance: DatabaseRepository | null = null;

  static create(config: DatabaseConfig): DatabaseRepository {
    switch (config.type) {
      case 'dynamodb':
        return new DynamoDBRepository(config.region, config.tableName);
      case 'sqlite':
        return new SQLiteRepository(config.filePath);
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  static getInstance(config?: DatabaseConfig): DatabaseRepository {
    if (!DatabaseFactory.instance) {
      if (!config) {
        const defaultConfig: DatabaseConfig = {
          type: process.env.DATABASE_TYPE as 'dynamodb' | 'sqlite' || 'sqlite',
          region: process.env.AWS_REGION || 'us-east-1',
          tableName: process.env.DYNAMODB_TABLE_NAME || 'ecscd',
          filePath: process.env.SQLITE_DB_PATH || './ecscd.db'
        };
        config = defaultConfig;
      }
      DatabaseFactory.instance = DatabaseFactory.create(config);
    }
    return DatabaseFactory.instance;
  }

  static async closeInstance(): Promise<void> {
    if (DatabaseFactory.instance) {
      await DatabaseFactory.instance.close();
      DatabaseFactory.instance = null;
    }
  }
}