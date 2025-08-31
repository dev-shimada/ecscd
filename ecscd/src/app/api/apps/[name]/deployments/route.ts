import { NextRequest, NextResponse } from 'next/server';
import { DeploymentService } from '@/lib/deployment';
import { DatabaseFactory } from '@/lib/database';

// Global deployment service instance
const deploymentService = new DeploymentService();
const db = DatabaseFactory.getInstance();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('id');

    if (deploymentId) {
      // Get specific deployment status
      const deployment = await deploymentService.getDeploymentStatus(deploymentId);
      
      if (!deployment) {
        return NextResponse.json(
          { error: 'Deployment not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ deployment });
    } else {
      // Get all deployments for the application
      const app = await db.getApplicationByName(name);
      if (!app) {
        return NextResponse.json(
          { error: 'Application not found' },
          { status: 404 }
        );
      }
      
      const dbDeployments = await db.getDeploymentsByApplication(app.id);
      
      // Convert database deployments to API format
      const deployments = await Promise.all(
        dbDeployments.map(async (dbDeployment) => {
          const events = await db.getDeploymentEvents(dbDeployment.id);
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
        })
      );
      
      return NextResponse.json({ deployments });
    }
  } catch (error) {
    console.error('Error fetching deployment status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployment status' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Deployment ID is required' },
        { status: 400 }
      );
    }

    const success = await deploymentService.stopDeployment(deploymentId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to stop deployment or deployment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Deployment stopped successfully' });
  } catch (error) {
    console.error('Error stopping deployment:', error);
    return NextResponse.json(
      { error: 'Failed to stop deployment' },
      { status: 500 }
    );
  }
}