import { NextRequest, NextResponse } from 'next/server';
import { DatabaseFactory } from '@/lib/database/factory';

const db = DatabaseFactory.getInstance();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();
    const { spec, metadata } = body;

    if (!spec?.source?.repoURL || !metadata?.labels?.['ecscd.io/cluster'] || !metadata?.labels?.['ecscd.io/service'] || !spec?.taskDefinitionPath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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
          path: spec.taskDefinitionPath,
          token: existingApp.gitRepository.token // Preserve existing token
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

    // Update application in database
    const updated = await db.updateApplication(existingApp.id, {
      gitRepository,
      ecsCluster: metadata.labels['ecscd.io/cluster'],
      ecsService: metadata.labels['ecscd.io/service'],
      taskDefinitionPath: spec.taskDefinitionPath,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update application' },
        { status: 500 }
      );
    }

    // Reset sync status since configuration changed
    await db.createOrUpdateSyncStatus({
      applicationId: existingApp.id,
      status: 'OutOfSync',
      revision: '',
      message: 'Configuration updated'
    });

    return NextResponse.json({ message: 'Application updated successfully' });
  } catch (error) {
    console.error('Error updating application:', error);
    return NextResponse.json(
      { error: 'Failed to update application' },
      { status: 500 }
    );
  }
}