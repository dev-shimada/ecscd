import { NextRequest, NextResponse } from 'next/server';
import { AWSService } from '@/lib/aws';
import { GitHubService } from '@/lib/github';
import { DiffService } from '@/lib/diff';
import { ECSTaskDefinition } from '@/types/ecs';
import { DatabaseFactory } from '@/lib/database/factory';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    
    // Get application config from database
    const db = DatabaseFactory.getInstance();
    const application = await db.getApplicationByName(name);
    
    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    const gitOwner = application.gitRepository.owner;
    const gitRepo = application.gitRepository.repo;
    const gitPath = application.gitRepository.path || 'task-definition.json';
    const ecsCluster = application.ecsCluster;
    const ecsService = application.ecsService;

    // Get current task definition from ECS
    const awsService = new AWSService(process.env.AWS_REGION || 'us-east-1', application.awsConfig);
    let service;
    let currentTaskDef: ECSTaskDefinition | null = null;
    
    try {
      service = await awsService.getService(ecsCluster, ecsService);
      if (!service) {
        return NextResponse.json({
          application: name,
          error: `ECS service '${ecsService}' not found in cluster '${ecsCluster}'. Please verify the service name and cluster configuration.`,
          summary: 'ECS service not found',
          diffs: [],
          current: null,
          target: null,
          syncStatus: 'Unknown'
        });
      }

      if (service.taskDefinition) {
        currentTaskDef = await awsService.getTaskDefinition(service.taskDefinition);
        if (!currentTaskDef) {
          return NextResponse.json({
            application: name,
            error: `Failed to retrieve task definition '${service.taskDefinition}' for service '${ecsService}'. The task definition may have been deleted.`,
            summary: 'Current task definition not accessible',
            diffs: [],
            current: null,
            target: null,
            syncStatus: 'Unknown'
          });
        }
      } else {
        return NextResponse.json({
          application: name,
          error: `ECS service '${ecsService}' has no task definition associated. This is unusual and may indicate a service configuration issue.`,
          summary: 'No task definition associated with service',
          diffs: [],
          current: null,
          target: null,
          syncStatus: 'Unknown'
        });
      }
    } catch (error) {
      console.error('Error fetching ECS service or task definition:', error);
      return NextResponse.json({
        application: name,
        error: `Failed to fetch current ECS service configuration from cluster '${ecsCluster}'. Please check AWS credentials and permissions for ECS access.`,
        summary: 'Unable to retrieve current configuration',
        diffs: [],
        current: null,
        target: null,
        syncStatus: 'Unknown'
      });
    }

    // Get target task definition from GitHub
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    const githubService = new GitHubService(githubToken);
    let targetTaskDefContent: string | null = null;
    let targetTaskDef: ECSTaskDefinition | null = null;
    
    try {
      targetTaskDefContent = await githubService.getFileContent(
        gitOwner,
        gitRepo,
        gitPath,
        application.gitRepository.branch
      );
    } catch (error) {
      console.error('Error fetching GitHub file content:', error);
      return NextResponse.json({
        application: name,
        error: `Failed to fetch target configuration from GitHub repository ${gitOwner}/${gitRepo}. Please check GitHub token and repository access.`,
        summary: 'Unable to retrieve target configuration',
        diffs: [],
        current: { taskDefinition: currentTaskDef },
        target: null,
        syncStatus: 'Unknown'
      });
    }

    if (!targetTaskDefContent) {
      return NextResponse.json({
        application: name,
        error: `Task definition file not found at ${gitPath} in repository ${gitOwner}/${gitRepo}`,
        summary: 'Target configuration file not found',
        diffs: [],
        current: { taskDefinition: currentTaskDef },
        target: null,
        syncStatus: 'Unknown'
      });
    }

    try {
      targetTaskDef = JSON.parse(targetTaskDefContent);
    } catch (error) {
      console.error('Error parsing target task definition:', error);
      return NextResponse.json({
        application: name,
        error: `Invalid JSON format in task definition file ${gitPath}`,
        summary: 'Target configuration has invalid format',
        diffs: [],
        current: { taskDefinition: currentTaskDef },
        target: null,
        syncStatus: 'Unknown'
      });
    }

    // Generate diff
    const diffs = DiffService.compareTaskDefinitions(currentTaskDef, targetTaskDef);
    const summary = DiffService.generateDiffSummary(diffs);

    // Get latest commit info
    const latestCommit = await githubService.getLatestCommit(
      gitOwner, 
      gitRepo, 
      application.gitRepository.branch || 'main'
    );

    return NextResponse.json({
      application: name,
      summary,
      diffs,
      current: {
        taskDefinition: currentTaskDef,
        revision: currentTaskDef?.revision || 0,
        service: {
          name: service.serviceName,
          cluster: ecsCluster,
          taskDefinitionArn: service.taskDefinition,
          desiredCount: service.desiredCount,
          runningCount: service.runningCount,
          status: service.status
        }
      },
      target: {
        taskDefinition: targetTaskDef,
        commit: latestCommit,
        repository: {
          owner: gitOwner,
          repo: gitRepo,
          path: gitPath,
          branch: application.gitRepository.branch || 'main'
        }
      },
      syncStatus: diffs.length === 0 ? 'Synced' : 'OutOfSync'
    });
  } catch (error) {
    console.error('Error generating diff:', error);
    return NextResponse.json(
      { error: 'Failed to generate diff' },
      { status: 500 }
    );
  }
}
