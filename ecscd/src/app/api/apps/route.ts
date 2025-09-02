import { NextRequest, NextResponse } from 'next/server';
import { Application } from '@/types/ecs';
import { DatabaseFactory } from '@/lib/database/factory';
import { AWSService, DeploymentInfo } from '@/lib/aws';
import { GitHubService } from '@/lib/github';
import { DiffService } from '@/lib/diff';

const db = DatabaseFactory.getInstance();

export async function GET() {
  try {
    const dbApplications = await db.getAllApplications();
    const awsService = new AWSService();
    
    // Convert database applications to API format
    const applications: Application[] = await Promise.all(
      dbApplications.map(async (dbApp) => {
        const syncStatus = await db.getSyncStatus(dbApp.id);
        const appStatus = await db.getApplicationStatus(dbApp.id);
        
        console.log(`App ${dbApp.name} sync status from DB:`, {
          status: syncStatus?.status,
          revision: syncStatus?.revision,
          lastSyncedAt: syncStatus?.lastSyncedAt
        });

        // Get current ECS service information to update revision and check diff
        let currentRevision = syncStatus?.revision || '';
        let currentSyncStatus = syncStatus?.status || 'Unknown';
        let statusMessage = syncStatus?.message || '';
        let hasError = false;
        let latestDeployment: DeploymentInfo | null = null;
        
        try {
          const appAwsService = new AWSService(process.env.AWS_REGION || 'us-east-1', dbApp.awsConfig);
          const ecsService = await appAwsService.getService(dbApp.ecsCluster, dbApp.ecsService);
          if (ecsService && ecsService.taskDefinition) {
            currentRevision = ecsService.taskDefinition;
            console.log(`Updated revision for ${dbApp.name} from ECS:`, currentRevision);
            
            // Get the latest deployment status from ECS
            const deploymentInfos = await appAwsService.getDeploymentInfo(dbApp.ecsCluster, dbApp.ecsService);
            latestDeployment = deploymentInfos.length > 0 ? deploymentInfos[0] : null;
            
            // Check diff to determine sync status
            try {
              // Get current task definition from ECS
              const currentTaskDef = await appAwsService.getTaskDefinition(ecsService.taskDefinition);
              
              if (!currentTaskDef) {
                console.error(`Failed to get current task definition for ${dbApp.name}: ${ecsService.taskDefinition}`);
                currentSyncStatus = 'Error';
                statusMessage = `Failed to retrieve current task definition: ${ecsService.taskDefinition}`;
                hasError = true;
              } else {
                // Get target task definition from GitHub
                const githubService = new GitHubService(dbApp.gitRepository.token || process.env.GITHUB_TOKEN);
                let targetTaskDefContent;
                
                try {
                  targetTaskDefContent = await githubService.getFileContent(
                    dbApp.gitRepository.owner,
                    dbApp.gitRepository.repo,
                    dbApp.taskDefinitionPath,
                    dbApp.gitRepository.branch || 'main'
                  );
                } catch (githubError) {
                  console.error(`Failed to get target task definition from GitHub for ${dbApp.name}:`, githubError);
                  currentSyncStatus = 'Error';
                  statusMessage = `Failed to connect to GitHub: ${githubError instanceof Error ? githubError.message : 'Unknown error'}`;
                  hasError = true;
                }

                if (!hasError) {
                  if (!targetTaskDefContent) {
                    console.error(`Target task definition not found in GitHub for ${dbApp.name}: ${dbApp.taskDefinitionPath}`);
                    currentSyncStatus = 'Error';
                    statusMessage = `Target task definition not found: ${dbApp.taskDefinitionPath}`;
                  } else {
                    try {
                      const targetTaskDef = JSON.parse(targetTaskDefContent);
                      const diffs = DiffService.compareTaskDefinitions(currentTaskDef, targetTaskDef);
                      
                      // Update sync status based on diff results
                      currentSyncStatus = diffs.length > 0 ? 'OutOfSync' : 'Synced';
                      statusMessage = currentSyncStatus === 'Synced' ? 'Configuration matches target' : 'Configuration differs from target';
                      console.log(`Diff check for ${dbApp.name}: ${diffs.length} differences found, status: ${currentSyncStatus}`);
                    } catch (parseError) {
                      console.error(`Failed to parse target task definition for ${dbApp.name}:`, parseError);
                      currentSyncStatus = 'Error';
                      statusMessage = `Invalid task definition format in GitHub: ${parseError instanceof Error ? parseError.message : 'JSON parse error'}`;
                    }
                  }
                }
              }
            } catch (diffError) {
              console.error(`Failed to check diff for ${dbApp.name}:`, diffError);
              currentSyncStatus = 'Error';
              statusMessage = `Failed to perform diff check: ${diffError instanceof Error ? diffError.message : 'Unknown error'}`;
            }
            
            // Update sync status in database with current ECS task definition and diff-based status
            if (syncStatus && (currentRevision !== syncStatus.revision || currentSyncStatus !== syncStatus.status || statusMessage !== syncStatus.message)) {
              await db.createOrUpdateSyncStatus({
                applicationId: dbApp.id,
                status: currentSyncStatus,
                revision: currentRevision,
                lastSyncedAt: syncStatus.lastSyncedAt,
                message: statusMessage
              });
              console.log(`Updated sync status for ${dbApp.name}: ${syncStatus.status} -> ${currentSyncStatus}, message: "${statusMessage}"`);
            }
          } else {
            console.error(`ECS service not found for ${dbApp.name}: cluster=${dbApp.ecsCluster}, service=${dbApp.ecsService}`);
            currentSyncStatus = 'Error';
            statusMessage = `ECS service not found: ${dbApp.ecsCluster}/${dbApp.ecsService}`;
            
            // Update sync status to Error
            if (syncStatus && currentSyncStatus !== syncStatus.status) {
              await db.createOrUpdateSyncStatus({
                applicationId: dbApp.id,
                status: currentSyncStatus,
                revision: syncStatus.revision,
                lastSyncedAt: syncStatus.lastSyncedAt,
                message: statusMessage
              });
              console.log(`Updated sync status for ${dbApp.name}: ${syncStatus.status} -> ${currentSyncStatus}, message: "${statusMessage}"`);
            }
          }
        } catch (error) {
          console.error(`Failed to get current ECS service info for ${dbApp.name}:`, error);
          currentSyncStatus = 'Error';
          statusMessage = `Failed to connect to ECS: ${error instanceof Error ? error.message : 'Unknown error'}`;
          
          // Update sync status to Error
          if (syncStatus && currentSyncStatus !== syncStatus.status) {
            await db.createOrUpdateSyncStatus({
              applicationId: dbApp.id,
              status: currentSyncStatus,
              revision: syncStatus?.revision || '',
              lastSyncedAt: syncStatus?.lastSyncedAt,
              message: statusMessage
            });
            console.log(`Updated sync status for ${dbApp.name}: ${syncStatus?.status || 'Unknown'} -> ${currentSyncStatus}, message: "${statusMessage}"`);
          }
        }
        
        return {
          metadata: {
            name: dbApp.name,
            labels: {
              'app.kubernetes.io/name': dbApp.name
            }
          },
          spec: {
            name: dbApp.name,
            gitRepository: dbApp.gitRepository,
            ecsCluster: dbApp.ecsCluster,
            ecsService: dbApp.ecsService,
            taskDefinitionPath: dbApp.taskDefinitionPath,
            autoSync: dbApp.autoSync,
            syncPolicy: dbApp.syncPolicy
          },
          status: {
            health: appStatus?.health || 'Unknown',
            sync: {
              status: currentSyncStatus,
              revision: currentRevision,
              lastSyncedAt: syncStatus?.lastSyncedAt,
              message: statusMessage,
              deploymentStatus: latestDeployment ? {
                id: latestDeployment.id,
                status: latestDeployment.status,
                runningCount: latestDeployment.runningCount,
                desiredCount: latestDeployment.desiredCount,
                pendingCount: latestDeployment.pendingCount,
                rolloutState: latestDeployment.rolloutState,
                rolloutStateReason: latestDeployment.rolloutStateReason,
                createdAt: latestDeployment.createdAt,
                updatedAt: latestDeployment.updatedAt
              } : undefined
            },
            operationState: appStatus?.operationState
          }
        };
      })
    );
    
    return NextResponse.json({ applications });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, spec, metadata } = body;

    if (!name || !spec?.source?.repoURL || !metadata?.labels?.['ecscd.io/cluster'] || !metadata?.labels?.['ecscd.io/service'] || !spec?.taskDefinitionPath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if application with same name already exists
    const existingApp = await db.getApplicationByName(name);
    if (existingApp) {
      return NextResponse.json(
        { error: 'Application with this name already exists' },
        { status: 409 }
      );
    }

    // Parse repository URL to extract owner/repo
    const repoUrl = spec.source.repoURL;
    let gitRepository;
    
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        gitRepository = {
          owner: pathParts[pathParts.length - 2],
          repo: pathParts[pathParts.length - 1],
          branch: spec.source.targetRevision || 'main',
          path: spec.taskDefinitionPath
        };
      } else {
        throw new Error('Invalid repository URL format');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid repository URL format' },
        { status: 400 }
      );
    }

    // Create application in database
    const dbApplication = await db.createApplication({
      name,
      gitRepository,
      ecsCluster: metadata.labels['ecscd.io/cluster'],
      ecsService: metadata.labels['ecscd.io/service'],
      taskDefinitionPath: spec.taskDefinitionPath,
      autoSync: false,
      syncPolicy: {
        automated: false,
        selfHeal: false,
        prune: false
      },
      awsConfig: spec.awsConfig ? {
        region: spec.awsConfig.region,
        roleArn: spec.awsConfig.roleArn,
        externalId: spec.awsConfig.externalId,
        sessionName: spec.awsConfig.sessionName
      } : undefined
    });

    // Create initial sync status
    await db.createOrUpdateSyncStatus({
      applicationId: dbApplication.id,
      status: 'OutOfSync',
      revision: ''
    });

    // Create initial application status
    await db.createOrUpdateApplicationStatus({
      applicationId: dbApplication.id,
      health: 'Unknown'
    });

    const newApplication: Application = {
      metadata: {
        name,
        labels: {
          'app.kubernetes.io/name': name,
          ...metadata.labels
        }
      },
      spec: {
        name,
        gitRepository,
        ecsCluster: metadata.labels['ecscd.io/cluster'],
        ecsService: metadata.labels['ecscd.io/service'],
        taskDefinitionPath: spec.taskDefinitionPath,
        autoSync: false,
        syncPolicy: {
          automated: false,
          selfHeal: false,
          prune: false
        }
      },
      status: {
        health: 'Unknown',
        sync: {
          status: 'OutOfSync',
          revision: ''
        }
      }
    };

    return NextResponse.json({ application: newApplication }, { status: 201 });
  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json(
      { error: 'Failed to create application' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: 'Application name is required' },
        { status: 400 }
      );
    }

    // Check if application exists
    const existingApp = await db.getApplicationByName(name);
    if (!existingApp) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    // Delete all related data first
    await db.deleteSyncStatus(existingApp.id);
    await db.deleteApplicationStatus(existingApp.id);
    
    // Delete all deployments and their events
    const deployments = await db.getDeploymentsByApplication(existingApp.id);
    for (const deployment of deployments) {
      await db.deleteDeploymentEvents(deployment.id);
      await db.deleteDeployment(deployment.id);
    }

    // Finally delete the application
    const deleted = await db.deleteApplication(existingApp.id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete application' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting application:', error);
    return NextResponse.json(
      { error: 'Failed to delete application' },
      { status: 500 }
    );
  }
}
