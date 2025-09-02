import { ECSClient, DescribeTaskDefinitionCommand, DescribeServicesCommand, UpdateServiceCommand, ListClustersCommand, ListServicesCommand, RegisterTaskDefinitionCommand } from '@aws-sdk/client-ecs';
import { STSClient, AssumeRoleCommand, Credentials } from '@aws-sdk/client-sts';
import { ECSTaskDefinition, ECSService, ECSCluster } from '@/types/ecs';

export interface DeploymentInfo {
  id: string;
  status: 'PRIMARY' | 'ACTIVE' | 'DRAINING' | 'INACTIVE' | 'PENDING' | 'RUNNING' | 'STOPPED';
  taskDefinition: string;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  createdAt: Date;
  updatedAt: Date;
  rolloutState?: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  rolloutStateReason?: string;
}

export interface AWSConfig {
  region?: string;
  roleArn?: string;
  externalId?: string;
  sessionName?: string;
}

export class AWSService {
  private ecsClient: ECSClient;
  private region: string;
  private awsConfig?: AWSConfig;

  constructor(region: string = process.env.AWS_REGION || 'us-east-1', awsConfig?: AWSConfig) {
    this.region = awsConfig?.region || region;
    this.awsConfig = awsConfig;
    this.ecsClient = new ECSClient({ 
      region: this.region,
      maxAttempts: 3,
      retryMode: 'standard'
    });
  }

  async assumeRole(): Promise<Credentials | undefined> {
    if (!this.awsConfig?.roleArn) {
      return undefined;
    }

    try {
      const stsClient = new STSClient({ 
        region: this.region,
        maxAttempts: 3,
        retryMode: 'standard'
      });

      const command = new AssumeRoleCommand({
        RoleArn: this.awsConfig.roleArn,
        RoleSessionName: this.awsConfig.sessionName || `ecscd-session-${Date.now()}`,
        ExternalId: this.awsConfig.externalId,
        DurationSeconds: 3600 // 1 hour
      });

      const response = await stsClient.send(command);
      
      if (!response.Credentials) {
        throw new Error('Failed to assume role: No credentials returned');
      }

      return response.Credentials;
    } catch (error) {
      console.error('Error assuming role:', error);
      throw new Error(`Failed to assume role ${this.awsConfig.roleArn}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getECSClient(): Promise<ECSClient> {
    if (!this.awsConfig?.roleArn) {
      return this.ecsClient;
    }

    const credentials = await this.assumeRole();
    if (!credentials) {
      return this.ecsClient;
    }

    return new ECSClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.AccessKeyId!,
        secretAccessKey: credentials.SecretAccessKey!,
        sessionToken: credentials.SessionToken
      },
      maxAttempts: 3,
      retryMode: 'standard'
    });
  }

  async getTaskDefinition(taskDefinitionArn: string): Promise<ECSTaskDefinition | null> {
    try {
      const command = new DescribeTaskDefinitionCommand({
        taskDefinition: taskDefinitionArn,
        include: ['TAGS']
      });
      
      const ecsClient = await this.getECSClient();
      const response = await ecsClient.send(command);
      
      if (!response.taskDefinition) {
        return null;
      }

      return {
        taskDefinitionArn: response.taskDefinition.taskDefinitionArn || '',
        family: response.taskDefinition.family || '',
        revision: response.taskDefinition.revision || 0,
        status: response.taskDefinition.status || '',
        requiresAttributes: response.taskDefinition.requiresAttributes,
        placementConstraints: response.taskDefinition.placementConstraints,
        compatibilities: response.taskDefinition.compatibilities,
        requiresCompatibilities: response.taskDefinition.requiresCompatibilities,
        cpu: response.taskDefinition.cpu,
        memory: response.taskDefinition.memory,
        networkMode: response.taskDefinition.networkMode,
        executionRoleArn: response.taskDefinition.executionRoleArn,
        taskRoleArn: response.taskDefinition.taskRoleArn,
        containerDefinitions: response.taskDefinition.containerDefinitions || [],
        volumes: response.taskDefinition.volumes,
        registeredAt: response.taskDefinition.registeredAt,
        registeredBy: response.taskDefinition.registeredBy
      };
    } catch (error) {
      console.error('Error fetching task definition:', error);
      return null;
    }
  }

  async getService(clusterName: string, serviceName: string): Promise<ECSService | null> {
    try {
      const command = new DescribeServicesCommand({
        cluster: clusterName,
        services: [serviceName],
        include: ['TAGS']
      });

      const ecsClient = await this.getECSClient();
      const response = await ecsClient.send(command);
      
      if (!response.services || response.services.length === 0) {
        return null;
      }

      const service = response.services[0];
      
      return {
        serviceName: service.serviceName || '',
        serviceArn: service.serviceArn || '',
        clusterArn: service.clusterArn || '',
        taskDefinition: service.taskDefinition || '',
        desiredCount: service.desiredCount || 0,
        runningCount: service.runningCount || 0,
        pendingCount: service.pendingCount || 0,
        status: service.status || '',
        deployments: service.deployments?.map(deployment => ({
          id: deployment.id || '',
          status: deployment.status || '',
          taskDefinition: deployment.taskDefinition || '',
          desiredCount: deployment.desiredCount || 0,
          runningCount: deployment.runningCount || 0,
          pendingCount: deployment.pendingCount || 0,
          createdAt: deployment.createdAt || new Date(),
          updatedAt: deployment.updatedAt || new Date()
        })) || [],
        events: service.events?.map(event => ({
          id: event.id || '',
          createdAt: event.createdAt || new Date(),
          message: event.message || ''
        })),
        launchType: service.launchType,
        platformVersion: service.platformVersion,
        capacityProviderStrategy: service.capacityProviderStrategy,
        networkConfiguration: service.networkConfiguration,
        loadBalancers: service.loadBalancers,
        serviceRegistries: service.serviceRegistries,
        placementConstraints: service.placementConstraints,
        placementStrategy: service.placementStrategy,
        deploymentController: service.deploymentController,
        tags: service.tags,
        createdAt: service.createdAt,
        createdBy: service.createdBy,
        enableECSManagedTags: service.enableECSManagedTags,
        propagateTags: service.propagateTags,
        enableExecuteCommand: service.enableExecuteCommand
      };
    } catch (error) {
      console.error(`Error fetching service '${serviceName}' in cluster '${clusterName}' (region: ${this.region}):`, error);
      
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Failed to fetch ECS service: ${error.message}. Cluster: ${clusterName}, Service: ${serviceName}, Region: ${this.region}`);
      }
      throw error;
    }
  }

  async registerTaskDefinition(taskDefinition: ECSTaskDefinition): Promise<string | null> {
    try {
      const command = new RegisterTaskDefinitionCommand({
        family: taskDefinition.family,
        cpu: taskDefinition.cpu,
        memory: taskDefinition.memory,
        networkMode: taskDefinition.networkMode,
        requiresCompatibilities: taskDefinition.requiresCompatibilities,
        executionRoleArn: taskDefinition.executionRoleArn,
        taskRoleArn: taskDefinition.taskRoleArn,
        containerDefinitions: taskDefinition.containerDefinitions,
        volumes: taskDefinition.volumes,
        placementConstraints: taskDefinition.placementConstraints
      });

      const ecsClient = await this.getECSClient();
      const response = await ecsClient.send(command);
      const registeredArn = response.taskDefinition?.taskDefinitionArn || null;
      console.log('Task definition registered with ARN:', registeredArn);
      return registeredArn;
    } catch (error) {
      console.error('Error registering task definition:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to register task definition: ${error.message}`);
      }
      throw error;
    }
  }

  async updateService(clusterName: string, serviceName: string, taskDefinitionArn: string): Promise<string | null> {
    try {
      const command = new UpdateServiceCommand({
        cluster: clusterName,
        service: serviceName,
        taskDefinition: taskDefinitionArn,
        forceNewDeployment: true
      });

      const ecsClient = await this.getECSClient();
      const response = await ecsClient.send(command);
      console.log(`Service update initiated for ${serviceName} in cluster ${clusterName}`);
      
      // Return the deployment ID from the latest deployment
      const latestDeployment = response.service?.deployments?.[0];
      return latestDeployment?.id || null;
    } catch (error) {
      console.error(`Error updating service ${serviceName} in cluster ${clusterName}:`, error);
      if (error instanceof Error) {
        throw new Error(`Failed to update ECS service: ${error.message}`);
      }
      throw error;
    }
  }

  async getDeploymentInfo(clusterName: string, serviceName: string): Promise<DeploymentInfo[]> {
    try {
      const command = new DescribeServicesCommand({
        cluster: clusterName,
        services: [serviceName],
        include: ['TAGS']
      });

      const ecsClient = await this.getECSClient();
      const response = await ecsClient.send(command);
      
      if (!response.services || response.services.length === 0) {
        return [];
      }

      const service = response.services[0];
      
      return (service.deployments || []).map(deployment => ({
        id: deployment.id || '',
        status: deployment.status as any || 'PENDING',
        taskDefinition: deployment.taskDefinition || '',
        desiredCount: deployment.desiredCount || 0,
        runningCount: deployment.runningCount || 0,
        pendingCount: deployment.pendingCount || 0,
        createdAt: deployment.createdAt || new Date(),
        updatedAt: deployment.updatedAt || new Date(),
        rolloutState: deployment.rolloutState as any,
        rolloutStateReason: deployment.rolloutStateReason
      }));
    } catch (error) {
      console.error(`Error getting deployment info for service '${serviceName}' in cluster '${clusterName}':`, error);
      throw error;
    }
  }

  async waitForDeploymentStable(
    clusterName: string, 
    serviceName: string, 
    deploymentId: string,
    onProgress?: (info: DeploymentInfo) => void
  ): Promise<DeploymentInfo> {
    const maxAttempts = 120; // 20 minutes (120 * 10 seconds)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const deployments = await this.getDeploymentInfo(clusterName, serviceName);
        const targetDeployment = deployments.find(d => d.id === deploymentId) || deployments[0];
        
        if (targetDeployment) {
          // Send progress update if callback provided
          onProgress?.(targetDeployment);

          console.log(`Deployment ${targetDeployment.id}: ${targetDeployment.status} (${targetDeployment.runningCount}/${targetDeployment.desiredCount} tasks running)`);

          // Check if deployment is complete
          if (targetDeployment.status === 'PRIMARY' && 
              targetDeployment.runningCount === targetDeployment.desiredCount &&
              targetDeployment.rolloutState === 'COMPLETED') {
            console.log(`Deployment ${targetDeployment.id} completed successfully`);
            return targetDeployment;
          }

          // Check for failed deployment
          if (targetDeployment.status === 'STOPPED' || targetDeployment.rolloutState === 'FAILED') {
            throw new Error(`Deployment failed: ${targetDeployment.rolloutStateReason || 'Unknown reason'}`);
          }
        }

        await this.sleep(10000); // Wait 10 seconds before next check
        attempts++;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Deployment failed')) {
          throw error;
        }
        console.error('Error monitoring deployment:', error);
        await this.sleep(10000);
        attempts++;
      }
    }

    throw new Error(`Deployment monitoring timeout after ${maxAttempts * 10} seconds`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async listClusters(): Promise<string[]> {
    try {
      const command = new ListClustersCommand({});
      const ecsClient = await this.getECSClient();
      const response = await ecsClient.send(command);
      
      // Extract cluster names from ARNs for easier comparison
      return (response.clusterArns || []).map(arn => {
        const parts = arn.split('/');
        return parts[parts.length - 1]; // Get the cluster name from ARN
      });
    } catch (error) {
      console.error('Error listing clusters:', error);
      return [];
    }
  }

  async listServices(clusterName: string): Promise<string[]> {
    try {
      const command = new ListServicesCommand({
        cluster: clusterName
      });
      
      const ecsClient = await this.getECSClient();
      const response = await ecsClient.send(command);
      
      return response.serviceArns || [];
    } catch (error) {
      console.error('Error listing services:', error);
      return [];
    }
  }
}