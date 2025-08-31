import { NextRequest } from 'next/server';
import { GitHubService } from '@/lib/github';
import { DeploymentService } from '@/lib/deployment';
import { ECSTaskDefinition } from '@/types/ecs';
import { DatabaseFactory } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  
  try {
    // Fetch the application config from database
    const db = DatabaseFactory.getInstance();
    const app = await db.getApplicationByName(name);
    
    if (!app) {
      return new Response('Application not found', { status: 404 });
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
      return new Response('Target task definition not found in repository', { status: 404 });
    }

    let targetTaskDef: ECSTaskDefinition;
    try {
      targetTaskDef = JSON.parse(targetTaskDefContent);
    } catch {
      return new Response('Invalid task definition format in repository', { status: 400 });
    }

    // Create a streaming response for real-time deployment updates
    const encoder = new TextEncoder();
    let isControllerClosed = false;
    
    const stream = new ReadableStream({
      async start(controller) {
        const deploymentService = new DeploymentService();
        const deploymentId = `deployment-${Date.now()}`;
        
        const sendMessage = (data: any) => {
          if (!isControllerClosed) {
            try {
              const message = `data: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(message));
            } catch (error) {
              console.error('Error sending SSE message:', error);
            }
          }
        };
        
        try {
          console.log(`Starting deployment for ${name} (${deploymentId})`);
          console.log(`ECS Cluster: ${ecsCluster}, Service: ${ecsService}`);
          
          // Send initial status
          sendMessage({
            type: 'status',
            deploymentId,
            status: 'InProgress',
            message: 'Starting deployment...',
            progress: { current: 0, total: 4, message: 'Initializing deployment' },
            startedAt: new Date().toISOString(),
            events: []
          });

          // Execute deployment with progress updates
          const deployment = await deploymentService.executeDeploymentWithProgress(
            deploymentId,
            app.id,
            ecsCluster,
            ecsService,
            targetTaskDef,
            (progress) => {
              // Send progress update
              sendMessage({
                type: 'progress',
                deploymentId,
                status: progress.status,
                message: progress.message,
                progress: progress.progress,
                events: progress.events,
                startedAt: progress.startedAt.toISOString(),
                finishedAt: progress.finishedAt?.toISOString()
              });
            }
          );

          // Send final status
          sendMessage({
            type: 'complete',
            deploymentId,
            status: deployment.status,
            message: deployment.message,
            progress: deployment.progress,
            startedAt: deployment.startedAt.toISOString(),
            finishedAt: deployment.finishedAt?.toISOString(),
            events: deployment.events
          });

          // Use the registered task definition ARN if available, otherwise use the target ARN
          const revisionArn = deployment.registeredTaskDefArn || targetTaskDef.taskDefinitionArn || deploymentId;
          
          console.log('Deployment sync status update:');
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

          // Give client time to process the final message before closing
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
          console.error('Deployment error:', error);
          
          // Send error status
          sendMessage({
            type: 'error',
            deploymentId,
            status: 'Failed',
            message: errorMessage,
            finishedAt: new Date().toISOString(),
            events: []
          });

          // Update sync status as failed
          try {
            await db.createOrUpdateSyncStatus({
              applicationId: app.id,
              status: 'OutOfSync',
              revision: deploymentId,
              lastSyncedAt: new Date(),
              message: errorMessage
            });
          } catch (dbError) {
            console.error('Error updating sync status:', dbError);
          }

          // Give client time to process the error message before closing
          await new Promise(resolve => setTimeout(resolve, 100));
        } finally {
          // Close the connection
          if (!isControllerClosed) {
            isControllerClosed = true;
            try {
              controller.close();
            } catch (error) {
              console.error('Error closing controller:', error);
            }
          }
        }
      },
      
      cancel() {
        isControllerClosed = true;
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('Error starting streaming deployment:', error);
    return new Response(
      `data: ${JSON.stringify({
        type: 'error',
        message: 'Failed to start deployment',
        error: error instanceof Error ? error.message : 'Unknown error'
      })}\n\n`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream'
        }
      }
    );
  }
}