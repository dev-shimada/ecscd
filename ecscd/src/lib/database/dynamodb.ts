import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand, 
  UpdateCommand, 
  DeleteCommand,
  ScanCommand 
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseRepository } from './base';
import {
  DatabaseApplication,
  DatabaseDeployment,
  DatabaseDeploymentEvent,
  DatabaseSyncStatus,
  DatabaseApplicationStatus
} from '@/types/database';

export class DynamoDBRepository implements DatabaseRepository {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(region: string = 'us-east-1', tableName: string = 'ecscd') {
    const dynamoClient = new DynamoDBClient({ region });
    this.client = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        convertClassInstanceToMap: true
      }
    });
    this.tableName = tableName;
  }

  async createApplication(application: Omit<DatabaseApplication, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseApplication> {
    const now = new Date();
    const dbApplication: DatabaseApplication = {
      ...application,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `APP#${dbApplication.id}`,
        sk: `APP#${dbApplication.id}`,
        type: 'application',
        ...dbApplication
      }
    }));

    return dbApplication;
  }

  async getApplication(id: string): Promise<DatabaseApplication | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: {
        pk: `APP#${id}`,
        sk: `APP#${id}`
      }
    }));

    if (!result.Item) return null;

    const { pk, sk, type, ...application } = result.Item;
    return application as DatabaseApplication;
  }

  async getApplicationByName(name: string): Promise<DatabaseApplication | null> {
    const result = await this.client.send(new ScanCommand({
      TableName: this.tableName,
      FilterExpression: '#type = :type AND #name = :name',
      ExpressionAttributeNames: {
        '#type': 'type',
        '#name': 'name'
      },
      ExpressionAttributeValues: {
        ':type': 'application',
        ':name': name
      }
    }));

    if (!result.Items || result.Items.length === 0) return null;

    const { pk, sk, type, ...application } = result.Items[0];
    return application as DatabaseApplication;
  }

  async getAllApplications(): Promise<DatabaseApplication[]> {
    const result = await this.client.send(new ScanCommand({
      TableName: this.tableName,
      FilterExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'application'
      }
    }));

    if (!result.Items) return [];

    return result.Items.map(item => {
      const { pk, sk, type, ...application } = item;
      return application as DatabaseApplication;
    });
  }

  async updateApplication(id: string, updates: Partial<DatabaseApplication>): Promise<DatabaseApplication | null> {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date();

    try {
      const result = await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `APP#${id}`,
          sk: `APP#${id}`
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      }));

      if (!result.Attributes) return null;

      const { pk, sk, type, ...application } = result.Attributes;
      return application as DatabaseApplication;
    } catch (error) {
      console.error('Error updating application:', error);
      return null;
    }
  }

  async deleteApplication(id: string): Promise<boolean> {
    try {
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: `APP#${id}`,
          sk: `APP#${id}`
        }
      }));
      return true;
    } catch (error) {
      console.error('Error deleting application:', error);
      return false;
    }
  }

  async createDeployment(deployment: Omit<DatabaseDeployment, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseDeployment> {
    const now = new Date();
    const dbDeployment: DatabaseDeployment = {
      ...deployment,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `APP#${deployment.applicationId}`,
        sk: `DEPLOY#${dbDeployment.id}`,
        type: 'deployment',
        ...dbDeployment
      }
    }));

    return dbDeployment;
  }

  async getDeployment(id: string): Promise<DatabaseDeployment | null> {
    const result = await this.client.send(new ScanCommand({
      TableName: this.tableName,
      FilterExpression: '#type = :type AND id = :id',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'deployment',
        ':id': id
      }
    }));

    if (!result.Items || result.Items.length === 0) return null;

    const { pk, sk, type, ...deployment } = result.Items[0];
    return deployment as DatabaseDeployment;
  }

  async getDeploymentsByApplication(applicationId: string): Promise<DatabaseDeployment[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `APP#${applicationId}`,
        ':sk': 'DEPLOY#'
      }
    }));

    if (!result.Items) return [];

    return result.Items.map(item => {
      const { pk, sk, type, ...deployment } = item;
      return deployment as DatabaseDeployment;
    });
  }

  async updateDeployment(id: string, updates: Partial<DatabaseDeployment>): Promise<DatabaseDeployment | null> {
    const deployment = await this.getDeployment(id);
    if (!deployment) return null;

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date();

    try {
      const result = await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `APP#${deployment.applicationId}`,
          sk: `DEPLOY#${id}`
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      }));

      if (!result.Attributes) return null;

      const { pk, sk, type, ...updatedDeployment } = result.Attributes;
      return updatedDeployment as DatabaseDeployment;
    } catch (error) {
      console.error('Error updating deployment:', error);
      return null;
    }
  }

  async deleteDeployment(id: string): Promise<boolean> {
    const deployment = await this.getDeployment(id);
    if (!deployment) return false;

    try {
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: `APP#${deployment.applicationId}`,
          sk: `DEPLOY#${id}`
        }
      }));
      return true;
    } catch (error) {
      console.error('Error deleting deployment:', error);
      return false;
    }
  }

  async createDeploymentEvent(event: Omit<DatabaseDeploymentEvent, 'id' | 'createdAt'>): Promise<DatabaseDeploymentEvent> {
    const now = new Date();
    const dbEvent: DatabaseDeploymentEvent = {
      ...event,
      id: uuidv4(),
      createdAt: now
    };

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `DEPLOY#${event.deploymentId}`,
        sk: `EVENT#${dbEvent.id}`,
        entity_type: 'deployment_event',
        ...dbEvent
      }
    }));

    return dbEvent;
  }

  async getDeploymentEvents(deploymentId: string): Promise<DatabaseDeploymentEvent[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `DEPLOY#${deploymentId}`,
        ':sk': 'EVENT#'
      }
    }));

    if (!result.Items) return [];

    return result.Items.map(item => {
      const { pk, sk, type, ...event } = item;
      return event as DatabaseDeploymentEvent;
    });
  }

  async deleteDeploymentEvents(deploymentId: string): Promise<boolean> {
    try {
      const events = await this.getDeploymentEvents(deploymentId);
      
      for (const event of events) {
        await this.client.send(new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: `DEPLOY#${deploymentId}`,
            sk: `EVENT#${event.id}`
          }
        }));
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting deployment events:', error);
      return false;
    }
  }

  async createOrUpdateSyncStatus(status: Omit<DatabaseSyncStatus, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseSyncStatus> {
    const existing = await this.getSyncStatus(status.applicationId);
    const now = new Date();

    if (existing) {
      const updated = await this.updateSyncStatus(existing.id, status);
      return updated!;
    }

    const dbStatus: DatabaseSyncStatus = {
      ...status,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `APP#${status.applicationId}`,
        sk: `SYNC#${dbStatus.id}`,
        type: 'sync_status',
        ...dbStatus
      }
    }));

    return dbStatus;
  }

  private async updateSyncStatus(id: string, updates: Partial<DatabaseSyncStatus>): Promise<DatabaseSyncStatus | null> {
    const syncStatus = await this.getSyncStatus(updates.applicationId!);
    if (!syncStatus) return null;

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date();

    try {
      const result = await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `APP#${syncStatus.applicationId}`,
          sk: `SYNC#${id}`
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      }));

      if (!result.Attributes) return null;

      const { pk, sk, type, ...updatedStatus } = result.Attributes;
      return updatedStatus as DatabaseSyncStatus;
    } catch (error) {
      console.error('Error updating sync status:', error);
      return null;
    }
  }

  async getSyncStatus(applicationId: string): Promise<DatabaseSyncStatus | null> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `APP#${applicationId}`,
        ':sk': 'SYNC#'
      }
    }));

    if (!result.Items || result.Items.length === 0) return null;

    const { pk, sk, type, ...syncStatus } = result.Items[0];
    return syncStatus as DatabaseSyncStatus;
  }

  async deleteSyncStatus(applicationId: string): Promise<boolean> {
    const syncStatus = await this.getSyncStatus(applicationId);
    if (!syncStatus) return false;

    try {
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: `APP#${applicationId}`,
          sk: `SYNC#${syncStatus.id}`
        }
      }));
      return true;
    } catch (error) {
      console.error('Error deleting sync status:', error);
      return false;
    }
  }

  async createOrUpdateApplicationStatus(status: Omit<DatabaseApplicationStatus, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseApplicationStatus> {
    const existing = await this.getApplicationStatus(status.applicationId);
    const now = new Date();

    if (existing) {
      const updated = await this.updateApplicationStatus(existing.id, status);
      return updated!;
    }

    const dbStatus: DatabaseApplicationStatus = {
      ...status,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `APP#${status.applicationId}`,
        sk: `STATUS#${dbStatus.id}`,
        type: 'application_status',
        ...dbStatus
      }
    }));

    return dbStatus;
  }

  private async updateApplicationStatus(id: string, updates: Partial<DatabaseApplicationStatus>): Promise<DatabaseApplicationStatus | null> {
    const appStatus = await this.getApplicationStatus(updates.applicationId!);
    if (!appStatus) return null;

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date();

    try {
      const result = await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `APP#${appStatus.applicationId}`,
          sk: `STATUS#${id}`
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      }));

      if (!result.Attributes) return null;

      const { pk, sk, type, ...updatedStatus } = result.Attributes;
      return updatedStatus as DatabaseApplicationStatus;
    } catch (error) {
      console.error('Error updating application status:', error);
      return null;
    }
  }

  async getApplicationStatus(applicationId: string): Promise<DatabaseApplicationStatus | null> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `APP#${applicationId}`,
        ':sk': 'STATUS#'
      }
    }));

    if (!result.Items || result.Items.length === 0) return null;

    const { pk, sk, type, ...appStatus } = result.Items[0];
    return appStatus as DatabaseApplicationStatus;
  }

  async deleteApplicationStatus(applicationId: string): Promise<boolean> {
    const appStatus = await this.getApplicationStatus(applicationId);
    if (!appStatus) return false;

    try {
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: `APP#${applicationId}`,
          sk: `STATUS#${appStatus.id}`
        }
      }));
      return true;
    } catch (error) {
      console.error('Error deleting application status:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new ScanCommand({
        TableName: this.tableName,
        Limit: 1
      }));
      return true;
    } catch (error) {
      console.error('DynamoDB health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    // DynamoDB client doesn't need explicit closing
  }
}