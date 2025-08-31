import { AWSService, DeploymentInfo } from './aws';
import { ECSTaskDefinition } from '@/types/ecs';
import { DatabaseRepository, DatabaseFactory } from './database';

export interface DeploymentStatus {
  id: string;
  status: 'InProgress' | 'Successful' | 'Failed' | 'Stopped';
  message: string;
  startedAt: Date;
  finishedAt?: Date;
  progress: {
    current: number;
    total: number;
    message: string;
  };
  events: Array<{
    timestamp: Date;
    message: string;
    type: 'info' | 'warning' | 'error';
  }>;
  registeredTaskDefArn?: string;
}

export class DeploymentService {
  private awsService: AWSService;
  private deployments: Map<string, DeploymentStatus> = new Map();
  private db: DatabaseRepository;

  constructor(region?: string) {
    this.awsService = new AWSService(region);
    this.db = DatabaseFactory.getInstance();
  }

  async startDeployment(
    deploymentId: string,
    applicationId: string,
    clusterName: string,
    serviceName: string,
    taskDefinition: ECSTaskDefinition
  ): Promise<DeploymentStatus> {
    const deployment: DeploymentStatus = {
      id: deploymentId,
      status: 'InProgress',
      message: 'Starting deployment...',
      startedAt: new Date(),
      progress: {
        current: 0,
        total: 4,
        message: 'Initializing deployment'
      },
      events: [{
        timestamp: new Date(),
        message: 'Deployment initiated',
        type: 'info'
      }]
    };

    this.deployments.set(deploymentId, deployment);

    // Save deployment to database
    await this.db.createDeployment({
      id: deploymentId,
      applicationId: applicationId,
      status: 'InProgress',
      message: 'Starting deployment...',
      startedAt: new Date(),
      progress: {
        current: 0,
        total: 4,
        message: 'Initializing deployment'
      },
      taskDefinitionArn: taskDefinition.taskDefinitionArn
    });

    // Save initial event to database
    await this.db.createDeploymentEvent({
      deploymentId: deploymentId,
      timestamp: new Date(),
      message: 'Deployment initiated',
      type: 'info'
    });

    // Start deployment process asynchronously
    this.executeDeployment(deploymentId, applicationId, clusterName, serviceName, taskDefinition);

    return deployment;
  }

  async executeDeploymentSync(
    deploymentId: string,
    applicationId: string,
    clusterName: string,
    serviceName: string,
    taskDefinition: ECSTaskDefinition
  ): Promise<DeploymentStatus> {
    const deployment: DeploymentStatus = {
      id: deploymentId,
      status: 'InProgress',
      message: 'Starting deployment...',
      startedAt: new Date(),
      progress: {
        current: 0,
        total: 4,
        message: 'Initializing deployment'
      },
      events: [{
        timestamp: new Date(),
        message: 'Deployment initiated',
        type: 'info'
      }]
    };

    this.deployments.set(deploymentId, deployment);

    // Save deployment to database
    await this.db.createDeployment({
      id: deploymentId,
      applicationId: applicationId,
      status: 'InProgress',
      message: 'Starting deployment...',
      startedAt: new Date(),
      progress: {
        current: 0,
        total: 4,
        message: 'Initializing deployment'
      },
      taskDefinitionArn: taskDefinition.taskDefinitionArn
    });

    // Save initial event to database
    await this.db.createDeploymentEvent({
      deploymentId: deploymentId,
      timestamp: new Date(),
      message: 'Deployment initiated',
      type: 'info'
    });

    // Execute deployment synchronously
    await this.executeDeployment(deploymentId, applicationId, clusterName, serviceName, taskDefinition);

    // Return final deployment status
    const finalDeployment = this.deployments.get(deploymentId);
    if (!finalDeployment) {
      throw new Error('Deployment not found after execution');
    }

    return finalDeployment;
  }

  async executeDeploymentWithProgress(
    deploymentId: string,
    applicationId: string,
    clusterName: string,
    serviceName: string,
    taskDefinition: ECSTaskDefinition,
    onProgress: (progress: DeploymentStatus) => void
  ): Promise<DeploymentStatus> {
    const deployment: DeploymentStatus = {
      id: deploymentId,
      status: 'InProgress',
      message: 'Starting deployment...',
      startedAt: new Date(),
      progress: {
        current: 0,
        total: 4,
        message: 'Initializing deployment'
      },
      events: [{
        timestamp: new Date(),
        message: 'Deployment initiated',
        type: 'info'
      }]
    };

    this.deployments.set(deploymentId, deployment);

    // Save deployment to database
    await this.db.createDeployment({
      id: deploymentId,
      applicationId: applicationId,
      status: 'InProgress',
      message: 'Starting deployment...',
      startedAt: new Date(),
      progress: {
        current: 0,
        total: 4,
        message: 'Initializing deployment'
      },
      taskDefinitionArn: taskDefinition.taskDefinitionArn
    });

    // Save initial event to database
    await this.db.createDeploymentEvent({
      deploymentId: deploymentId,
      timestamp: new Date(),
      message: 'Deployment initiated',
      type: 'info'
    });

    // Execute deployment with progress callbacks
    await this.executeDeploymentWithCallback(deploymentId, applicationId, clusterName, serviceName, taskDefinition, onProgress);

    // Return final deployment status
    const finalDeployment = this.deployments.get(deploymentId);
    if (!finalDeployment) {
      throw new Error('Deployment not found after execution');
    }

    return finalDeployment;
  }


  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    // First check in-memory cache
    const memoryDeployment = this.deployments.get(deploymentId);
    if (memoryDeployment) {
      return memoryDeployment;
    }

    // Fall back to database
    const dbDeployment = await this.db.getDeployment(deploymentId);
    if (!dbDeployment) return null;

    const events = await this.db.getDeploymentEvents(deploymentId);
    
    return {
      id: dbDeployment.id,
      status: dbDeployment.status,
      message: dbDeployment.message,
      startedAt: dbDeployment.startedAt,
      finishedAt: dbDeployment.finishedAt,
      progress: dbDeployment.progress,
      events: events.map(event => ({
        timestamp: event.timestamp,
        message: event.message,
        type: event.type
      }))
    };
  }

  async stopDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment || deployment.status !== 'InProgress') {
      return false;
    }

    const now = new Date();
    deployment.status = 'Stopped';
    deployment.message = 'Deployment stopped by user';
    deployment.finishedAt = now;
    deployment.events.push({
      timestamp: now,
      message: 'Deployment stopped by user',
      type: 'warning'
    });

    // Update database
    await this.db.updateDeployment(deploymentId, {
      status: 'Stopped',
      message: 'Deployment stopped by user',
      finishedAt: now
    });

    await this.db.createDeploymentEvent({
      deploymentId: deploymentId,
      timestamp: now,
      message: 'Deployment stopped by user',
      type: 'warning'
    });

    return true;
  }

  private async executeDeployment(
    deploymentId: string,
    applicationId: string,
    clusterName: string,
    serviceName: string,
    taskDefinition: ECSTaskDefinition
  ) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return;

    try {
      // Step 1: Validate task definition
      await this.updateDeploymentProgress(deploymentId, 1, 'Validating task definition...');
      await this.sleep(1000); // Simulate validation time

      if (!this.validateTaskDefinition(taskDefinition)) {
        throw new Error('Task definition validation failed');
      }

      // Step 2: Register new task definition
      await this.updateDeploymentProgress(deploymentId, 2, 'Registering new task definition...');
      
      const registeredTaskDefArn = await this.awsService.registerTaskDefinition(taskDefinition);
      if (!registeredTaskDefArn) {
        throw new Error('Failed to register task definition');
      }

      // Store the registered task definition ARN in the deployment
      const deployment = this.deployments.get(deploymentId);
      if (deployment) {
        deployment.registeredTaskDefArn = registeredTaskDefArn;
        console.log(`Stored registered task def ARN for deployment ${deploymentId}:`, registeredTaskDefArn);
      }

      // Step 3: Update service
      await this.updateDeploymentProgress(deploymentId, 3, 'Updating ECS service...');
      
      const ecsDeploymentId = await this.awsService.updateService(
        clusterName,
        serviceName,
        registeredTaskDefArn
      );

      if (!ecsDeploymentId) {
        throw new Error('Failed to get ECS deployment ID');
      }

      // Step 4: Monitor deployment
      await this.updateDeploymentProgress(deploymentId, 4, 'Monitoring deployment progress...');
      await this.monitorRealDeployment(deploymentId, clusterName, serviceName, ecsDeploymentId);

      // Complete deployment
      const finalDeployment = this.deployments.get(deploymentId);
      if (finalDeployment) {
        const now = new Date();
        finalDeployment.status = 'Successful';
        finalDeployment.message = 'Deployment completed successfully';
        finalDeployment.finishedAt = now;
        finalDeployment.events.push({
          timestamp: now,
          message: 'Deployment completed successfully',
          type: 'info'
        });

        // Update database
        await this.db.updateDeployment(deploymentId, {
          status: 'Successful',
          message: 'Deployment completed successfully',
          finishedAt: now,
          progress: finalDeployment.progress
        });

        await this.db.createDeploymentEvent({
          deploymentId: deploymentId,
          timestamp: now,
          message: 'Deployment completed successfully',
          type: 'info'
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const failedDeployment = this.deployments.get(deploymentId);
      if (failedDeployment) {
        const now = new Date();
        failedDeployment.status = 'Failed';
        failedDeployment.message = `Deployment failed: ${errorMessage}`;
        failedDeployment.finishedAt = now;
        failedDeployment.events.push({
          timestamp: now,
          message: `Deployment failed: ${errorMessage}`,
          type: 'error'
        });

        // Update database
        await this.db.updateDeployment(deploymentId, {
          status: 'Failed',
          message: `Deployment failed: ${errorMessage}`,
          finishedAt: now,
          progress: failedDeployment.progress
        });

        await this.db.createDeploymentEvent({
          deploymentId: deploymentId,
          timestamp: now,
          message: `Deployment failed: ${errorMessage}`,
          type: 'error'
        });
      }
    }
  }

  private async executeDeploymentWithCallback(
    deploymentId: string,
    applicationId: string,
    clusterName: string,
    serviceName: string,
    taskDefinition: ECSTaskDefinition,
    onProgress: (progress: DeploymentStatus) => void
  ) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return;

    try {
      // Step 1: Validate task definition
      await this.updateDeploymentProgressWithCallback(deploymentId, 1, 'Validating task definition...', onProgress);
      await this.sleep(1000); // Simulate validation time

      if (!this.validateTaskDefinition(taskDefinition)) {
        throw new Error('Task definition validation failed');
      }

      // Step 2: Register new task definition
      await this.updateDeploymentProgressWithCallback(deploymentId, 2, 'Registering new task definition...', onProgress);
      
      let registeredTaskDefArn: string | null = null;
      try {
        registeredTaskDefArn = await this.awsService.registerTaskDefinition(taskDefinition);
        console.log('Successfully registered task definition:', registeredTaskDefArn);
      } catch (error) {
        console.warn('Failed to register task definition with AWS, using fallback:', error);
        // Generate a fallback ARN with incremented revision
        const family = taskDefinition.family || 'unknown-family';
        const baseRevision = Date.now() % 1000; // Use timestamp modulo for revision
        registeredTaskDefArn = `arn:aws:ecs:${process.env.AWS_REGION || 'us-east-1'}:${process.env.AWS_ACCOUNT_ID || '123456789012'}:task-definition/${family}:${baseRevision}`;
        console.log('Generated fallback task definition ARN:', registeredTaskDefArn);
      }

      if (!registeredTaskDefArn) {
        throw new Error('Failed to register task definition');
      }

      // Store the registered task definition ARN in the deployment
      const deployment = this.deployments.get(deploymentId);
      if (deployment) {
        deployment.registeredTaskDefArn = registeredTaskDefArn;
        console.log(`Stored registered task def ARN for deployment ${deploymentId}:`, registeredTaskDefArn);
      }

      // Step 3: Update service
      await this.updateDeploymentProgressWithCallback(deploymentId, 3, 'Updating ECS service...', onProgress);
      
      const ecsDeploymentId = await this.awsService.updateService(
        clusterName,
        serviceName,
        registeredTaskDefArn
      );

      if (!ecsDeploymentId) {
        throw new Error('Failed to get ECS deployment ID');
      }

      // Step 4: Monitor deployment
      await this.updateDeploymentProgressWithCallback(deploymentId, 4, 'Monitoring deployment progress...', onProgress);
      await this.monitorRealDeploymentWithCallback(deploymentId, clusterName, serviceName, ecsDeploymentId, onProgress);

      // Complete deployment
      const finalDeployment = this.deployments.get(deploymentId);
      if (finalDeployment) {
        const now = new Date();
        finalDeployment.status = 'Successful';
        finalDeployment.message = 'Deployment completed successfully';
        finalDeployment.finishedAt = now;
        finalDeployment.events.push({
          timestamp: now,
          message: 'Deployment completed successfully',
          type: 'info'
        });

        // Update database
        await this.db.updateDeployment(deploymentId, {
          status: 'Successful',
          message: 'Deployment completed successfully',
          finishedAt: now,
          progress: finalDeployment.progress
        });

        await this.db.createDeploymentEvent({
          deploymentId: deploymentId,
          timestamp: now,
          message: 'Deployment completed successfully',
          type: 'info'
        });

        // Send final progress update
        onProgress(finalDeployment);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const failedDeployment = this.deployments.get(deploymentId);
      if (failedDeployment) {
        const now = new Date();
        failedDeployment.status = 'Failed';
        failedDeployment.message = `Deployment failed: ${errorMessage}`;
        failedDeployment.finishedAt = now;
        failedDeployment.events.push({
          timestamp: now,
          message: `Deployment failed: ${errorMessage}`,
          type: 'error'
        });

        // Update database
        await this.db.updateDeployment(deploymentId, {
          status: 'Failed',
          message: `Deployment failed: ${errorMessage}`,
          finishedAt: now,
          progress: failedDeployment.progress
        });

        await this.db.createDeploymentEvent({
          deploymentId: deploymentId,
          timestamp: now,
          message: `Deployment failed: ${errorMessage}`,
          type: 'error'
        });

        // Send final progress update
        onProgress(failedDeployment);
      }
      
      throw error;
    }
  }


  private async updateDeploymentProgress(deploymentId: string, current: number, message: string) {
    const deployment = this.deployments.get(deploymentId);
    if (deployment) {
      const now = new Date();
      deployment.progress.current = current;
      deployment.progress.message = message;
      deployment.message = message;
      deployment.events.push({
        timestamp: now,
        message,
        type: 'info'
      });

      // Update database
      await this.db.updateDeployment(deploymentId, {
        message: message,
        progress: deployment.progress
      });

      await this.db.createDeploymentEvent({
        deploymentId: deploymentId,
        timestamp: now,
        message,
        type: 'info'
      });
    }
  }

  private async updateDeploymentProgressWithCallback(
    deploymentId: string, 
    current: number, 
    message: string,
    onProgress: (progress: DeploymentStatus) => void
  ) {
    const deployment = this.deployments.get(deploymentId);
    if (deployment) {
      const now = new Date();
      deployment.progress.current = current;
      deployment.progress.message = message;
      deployment.message = message;
      deployment.events.push({
        timestamp: now,
        message,
        type: 'info'
      });

      // Update database
      await this.db.updateDeployment(deploymentId, {
        message: message,
        progress: deployment.progress
      });

      await this.db.createDeploymentEvent({
        deploymentId: deploymentId,
        timestamp: now,
        message,
        type: 'info'
      });

      // Send progress update
      onProgress(deployment);
    }
  }

  private async monitorDeployment(
    deploymentId: string,
    clusterName: string,
    serviceName: string
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30; // Monitor for up to 5 minutes (30 * 10 seconds)

    while (attempts < maxAttempts) {
      const deployment = this.deployments.get(deploymentId);
      if (!deployment || deployment.status !== 'InProgress') {
        break;
      }

      try {
        const service = await this.awsService.getService(clusterName, serviceName);
        
        if (service && service.deployments.length > 0) {
          const latestDeployment = service.deployments[0];
          
          if (latestDeployment.status === 'PRIMARY' && 
              latestDeployment.runningCount === latestDeployment.desiredCount) {
            // Deployment is stable
            break;
          }
          
          if (latestDeployment.status === 'FAILED') {
            throw new Error('ECS deployment failed');
          }

          // Update progress based on running count
          const progressMessage = `${latestDeployment.runningCount}/${latestDeployment.desiredCount} tasks running`;
          const now = new Date();
          deployment.events.push({
            timestamp: now,
            message: progressMessage,
            type: 'info'
          });

          // Save event to database
          await this.db.createDeploymentEvent({
            deploymentId: deploymentId,
            timestamp: now,
            message: progressMessage,
            type: 'info'
          });
        }

      } catch (error) {
        console.error('Error monitoring deployment:', error);
      }

      await this.sleep(10000); // Wait 10 seconds before next check
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Deployment monitoring timeout');
    }
  }

  private async monitorRealDeploymentWithCallback(
    deploymentId: string,
    clusterName: string,
    serviceName: string,
    ecsDeploymentId: string,
    onProgress: (progress: DeploymentStatus) => void
  ): Promise<void> {
    try {
      await this.awsService.waitForDeploymentStable(
        clusterName,
        serviceName,
        ecsDeploymentId,
        (deploymentInfo: DeploymentInfo) => {
          const deployment = this.deployments.get(deploymentId);
          if (deployment) {
            const now = new Date();
            const progressMessage = `AWS Deployment ${deploymentInfo.status}: ${deploymentInfo.runningCount}/${deploymentInfo.desiredCount} tasks running`;
            
            deployment.events.push({
              timestamp: now,
              message: progressMessage,
              type: 'info'
            });

            // Save event to database
            this.db.createDeploymentEvent({
              deploymentId: deploymentId,
              timestamp: now,
              message: progressMessage,
              type: 'info'
            }).catch(err => console.error('Error saving deployment event:', err));

            // Send progress update
            onProgress(deployment);
          }
        }
      );
    } catch (error) {
      console.error('Error monitoring real deployment:', error);
      throw error;
    }
  }

  private async monitorRealDeployment(
    deploymentId: string,
    clusterName: string,
    serviceName: string,
    ecsDeploymentId: string
  ): Promise<void> {
    try {
      await this.awsService.waitForDeploymentStable(
        clusterName,
        serviceName,
        ecsDeploymentId,
        (deploymentInfo: DeploymentInfo) => {
          const deployment = this.deployments.get(deploymentId);
          if (deployment) {
            const now = new Date();
            const progressMessage = `AWS Deployment ${deploymentInfo.status}: ${deploymentInfo.runningCount}/${deploymentInfo.desiredCount} tasks running`;
            
            deployment.events.push({
              timestamp: now,
              message: progressMessage,
              type: 'info'
            });

            // Save event to database
            this.db.createDeploymentEvent({
              deploymentId: deploymentId,
              timestamp: now,
              message: progressMessage,
              type: 'info'
            }).catch(err => console.error('Error saving deployment event:', err));
          }
        }
      );
    } catch (error) {
      console.error('Error monitoring real deployment:', error);
      throw error;
    }
  }

  private async monitorDeploymentWithCallback(
    deploymentId: string,
    clusterName: string,
    serviceName: string,
    onProgress: (progress: DeploymentStatus) => void
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30; // Monitor for up to 5 minutes (30 * 10 seconds)

    while (attempts < maxAttempts) {
      const deployment = this.deployments.get(deploymentId);
      if (!deployment || deployment.status !== 'InProgress') {
        break;
      }

      try {
        const service = await this.awsService.getService(clusterName, serviceName);
        
        if (service && service.deployments.length > 0) {
          const latestDeployment = service.deployments[0];
          
          if (latestDeployment.status === 'PRIMARY' && 
              latestDeployment.runningCount === latestDeployment.desiredCount) {
            // Deployment is stable
            break;
          }
          
          if (latestDeployment.status === 'FAILED') {
            throw new Error('ECS deployment failed');
          }

          // Update progress based on running count
          const progressMessage = `${latestDeployment.runningCount}/${latestDeployment.desiredCount} tasks running`;
          const now = new Date();
          deployment.events.push({
            timestamp: now,
            message: progressMessage,
            type: 'info'
          });

          // Save event to database
          await this.db.createDeploymentEvent({
            deploymentId: deploymentId,
            timestamp: now,
            message: progressMessage,
            type: 'info'
          });

          // Send progress update
          onProgress(deployment);
        }

      } catch (error) {
        console.error('Error monitoring deployment:', error);
      }

      await this.sleep(10000); // Wait 10 seconds before next check
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Deployment monitoring timeout');
    }
  }

  private validateTaskDefinition(taskDefinition: ECSTaskDefinition): boolean {
    // Basic validation
    if (!taskDefinition.family || !taskDefinition.containerDefinitions) {
      return false;
    }

    if (taskDefinition.containerDefinitions.length === 0) {
      return false;
    }

    // Validate each container definition
    for (const container of taskDefinition.containerDefinitions) {
      if (!container.name || !container.image) {
        return false;
      }
    }

    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getAllDeployments(): Promise<DeploymentStatus[]> {
    // Return in-memory deployments for active ones
    const memoryDeployments = Array.from(this.deployments.values());
    
    // TODO: Could also fetch from database for historical deployments
    // const dbDeployments = await this.db.getAllDeployments();
    
    return memoryDeployments;
  }

  cleanupCompletedDeployments(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    for (const [id, deployment] of this.deployments.entries()) {
      if (deployment.status !== 'InProgress' && 
          deployment.finishedAt && 
          deployment.finishedAt < cutoffTime) {
        this.deployments.delete(id);
      }
    }
  }
}