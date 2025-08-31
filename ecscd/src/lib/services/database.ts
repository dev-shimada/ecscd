import { DatabaseFactory, DatabaseConfig } from '@/lib/database';

let isInitialized = false;

export async function initializeDatabase(): Promise<void> {
  if (isInitialized) return;

  const config: DatabaseConfig = {
    type: (process.env.DATABASE_TYPE as 'dynamodb' | 'sqlite') || 'sqlite',
    region: process.env.AWS_REGION || 'us-east-1',
    tableName: process.env.DYNAMODB_TABLE_NAME || 'ecscd',
    filePath: process.env.SQLITE_DB_PATH || './ecscd.db'
  };

  const db = DatabaseFactory.getInstance(config);
  
  // Test database connection
  const healthy = await db.healthCheck();
  if (!healthy) {
    throw new Error('Database health check failed');
  }

  isInitialized = true;
  console.log(`Database initialized: ${config.type}`);
}

export async function closeDatabase(): Promise<void> {
  await DatabaseFactory.closeInstance();
  isInitialized = false;
}