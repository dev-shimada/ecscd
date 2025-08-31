import { 
  DatabaseApplication, 
  DatabaseDeployment, 
  DatabaseDeploymentEvent, 
  DatabaseSyncStatus, 
  DatabaseApplicationStatus 
} from '@/types/database';

export interface DatabaseRepository {
  // Application methods
  createApplication(application: Omit<DatabaseApplication, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseApplication>;
  getApplication(id: string): Promise<DatabaseApplication | null>;
  getApplicationByName(name: string): Promise<DatabaseApplication | null>;
  getAllApplications(): Promise<DatabaseApplication[]>;
  updateApplication(id: string, updates: Partial<DatabaseApplication>): Promise<DatabaseApplication | null>;
  deleteApplication(id: string): Promise<boolean>;

  // Deployment methods
  createDeployment(deployment: Omit<DatabaseDeployment, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseDeployment>;
  getDeployment(id: string): Promise<DatabaseDeployment | null>;
  getDeploymentsByApplication(applicationId: string): Promise<DatabaseDeployment[]>;
  updateDeployment(id: string, updates: Partial<DatabaseDeployment>): Promise<DatabaseDeployment | null>;
  deleteDeployment(id: string): Promise<boolean>;

  // Deployment event methods
  createDeploymentEvent(event: Omit<DatabaseDeploymentEvent, 'id' | 'createdAt'>): Promise<DatabaseDeploymentEvent>;
  getDeploymentEvents(deploymentId: string): Promise<DatabaseDeploymentEvent[]>;
  deleteDeploymentEvents(deploymentId: string): Promise<boolean>;

  // Sync status methods
  createOrUpdateSyncStatus(status: Omit<DatabaseSyncStatus, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseSyncStatus>;
  getSyncStatus(applicationId: string): Promise<DatabaseSyncStatus | null>;
  deleteSyncStatus(applicationId: string): Promise<boolean>;

  // Application status methods
  createOrUpdateApplicationStatus(status: Omit<DatabaseApplicationStatus, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseApplicationStatus>;
  getApplicationStatus(applicationId: string): Promise<DatabaseApplicationStatus | null>;
  deleteApplicationStatus(applicationId: string): Promise<boolean>;

  // Utility methods
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}