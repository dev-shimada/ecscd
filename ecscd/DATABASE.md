# Database Integration

This application now supports both SQLite and DynamoDB for persistent data storage.

## Configuration

Set the following environment variables to configure the database:

```bash
# Choose database type (sqlite or dynamodb)
DATABASE_TYPE=sqlite

# For SQLite
SQLITE_DB_PATH=./ecscd.db

# For DynamoDB
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=ecscd
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
```

## SQLite Setup

SQLite requires no additional setup. The database file will be created automatically when the application starts.

## DynamoDB Setup

For DynamoDB, you need to:

1. Create the table using the provided script:
   ```bash
   node scripts/create-dynamodb-table.js
   ```

2. Or create it manually with the following schema:
   - Table Name: `ecscd` (or your configured name)
   - Partition Key: `pk` (String)
   - Sort Key: `sk` (String)
   - Billing Mode: Pay per request

## Data Models

The application stores the following entities:

### Applications
- Stores application configurations including Git repository info and ECS settings
- Primary key: `APP#{applicationId}`

### Deployments
- Tracks deployment status and progress
- Primary key: `APP#{applicationId}`, Sort key: `DEPLOY#{deploymentId}`

### Deployment Events
- Stores deployment event logs
- Primary key: `DEPLOY#{deploymentId}`, Sort key: `EVENT#{eventId}`

### Sync Status
- Tracks application sync status with Git repository
- Primary key: `APP#{applicationId}`, Sort key: `SYNC#{syncStatusId}`

### Application Status
- Tracks overall application health status
- Primary key: `APP#{applicationId}`, Sort key: `STATUS#{statusId}`

## Usage

The database is automatically initialized when the application starts. You can switch between SQLite and DynamoDB by changing the `DATABASE_TYPE` environment variable.

### Example: Using SQLite (default)
```bash
DATABASE_TYPE=sqlite
SQLITE_DB_PATH=./my-app.db
```

### Example: Using DynamoDB
```bash
DATABASE_TYPE=dynamodb
AWS_REGION=us-west-2
DYNAMODB_TABLE_NAME=my-ecscd-table
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## Migration

To migrate from the previous in-memory storage to persistent storage, you'll need to recreate your applications through the API. The old in-memory data will not be automatically migrated.