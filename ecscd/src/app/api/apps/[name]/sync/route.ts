import { NextRequest, NextResponse } from 'next/server';
import { GitHubService } from '@/lib/github';
import { DeploymentService } from '@/lib/deployment';
import { ECSTaskDefinition } from '@/types/ecs';
import { DatabaseFactory } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();
    const { dryRun = false } = body;
    
    // Fetch the application config from database
    const db = DatabaseFactory.getInstance();
    const app = await db.getApplicationByName(name);
    
    if (!app) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }
    
    const gitOwner = app.gitRepository.owner;
    const gitRepo = app.gitRepository.repo;
    const gitBranch = app.gitRepository.branch || 'main';
    const gitPath = app.taskDefinitionPath;
    const ecsCluster = app.ecsCluster;
    const ecsService = app.ecsService;

    // Get target task definition from GitHub
    const githubService = new GitHubService(app.gitRepository.token || process.env.GITHUB_TOKEN);
    const targetTaskDefContent = await githubService.getFileContent(
      gitOwner,
      gitRepo,
      gitPath,
      gitBranch
    );

    if (!targetTaskDefContent) {
      return NextResponse.json(
        { error: 'Target task definition not found in repository' },
        { status: 404 }
      );
    }

    let targetTaskDef: ECSTaskDefinition;
    try {
      targetTaskDef = JSON.parse(targetTaskDefContent);
    } catch {
      return NextResponse.json(
        { error: 'Invalid task definition format in repository' },
        { status: 400 }
      );
    }

    if (dryRun) {
      return NextResponse.json({
        application: name,
        dryRun: true,
        message: 'Dry run completed successfully',
        changes: 'Would deploy new task definition and update service'
      });
    }

    // Start deployment using DeploymentService (synchronous)
    const deploymentService = new DeploymentService();
    const deploymentId = `deployment-${Date.now()}`;
    
    try {
      const deployment = await deploymentService.executeDeploymentSync(
        deploymentId,
        app.id,
        ecsCluster,
        ecsService,
        targetTaskDef
      );
      
      // Use the registered task definition ARN if available, otherwise use the target ARN
      const revisionArn = deployment.registeredTaskDefArn || targetTaskDef.taskDefinitionArn || deploymentId;
      
      console.log('Sync status update:');
      console.log('- registeredTaskDefArn:', deployment.registeredTaskDefArn);
      console.log('- targetTaskDef.taskDefinitionArn:', targetTaskDef.taskDefinitionArn);
      console.log('- deploymentId:', deploymentId);
      console.log('- final revisionArn:', revisionArn);

      // Update sync status in database
      await db.createOrUpdateSyncStatus({
        applicationId: app.id,
        status: deployment.status === 'Successful' ? 'Synced' : 'OutOfSync',
        revision: revisionArn,
        lastSyncedAt: new Date(),
        message: deployment.message
      });
      
      return NextResponse.json({
        application: name,
        deploymentId,
        status: deployment.status,
        message: deployment.message,
        startedAt: deployment.startedAt.toISOString(),
        finishedAt: deployment.finishedAt?.toISOString(),
        progress: deployment.progress,
        events: deployment.events
      });
    } catch (error) {
      // Update sync status as failed
      await db.createOrUpdateSyncStatus({
        applicationId: app.id,
        status: 'OutOfSync',
        revision: targetTaskDef.taskDefinitionArn || deploymentId,
        lastSyncedAt: new Date(),
        message: error instanceof Error ? error.message : 'Deployment failed'
      });
      
      throw error;
    }

  } catch (error) {
    console.error('Error syncing application:', error);
    return NextResponse.json(
      { error: 'Failed to sync application' },
      { status: 500 }
    );
  }
}