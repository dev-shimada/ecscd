import { NextRequest, NextResponse } from "next/server";
import { au } from "@/lib/di";

export async function GET() {
  try {
    const applications = await au.getApplications();
    return NextResponse.json({ applications });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, gitConfig, ecsConfig, awsConfig } = body;
    if (!name || !gitConfig || !ecsConfig || !awsConfig) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if application with same name already exists
    const existingApps = await au.getApplications();
    if (existingApps.find((app) => app.name === name)) {
      return NextResponse.json(
        { error: "Application with this name already exists" },
        { status: 409 }
      );
    }
    const newApp = {
      name,
      gitConfig,
      ecsConfig,
      awsConfig,
      sync: { status: "Error" as const },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await au.createApplication(newApp);
    return NextResponse.json(
      { message: "Application created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating application:", error);
    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    );
  }
}

// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json();
//     const { name, spec, metadata } = body;

//     if (!name || !spec?.source?.repoURL || !metadata?.labels?.['ecscd.io/cluster'] || !metadata?.labels?.['ecscd.io/service'] || !spec?.taskDefinitionPath) {
//       return NextResponse.json(
//         { error: 'Missing required fields' },
//         { status: 400 }
//       );
//     }

//     // Check if application with same name already exists
//     const existingApp = await db.getApplicationByName(name);
//     if (existingApp) {
//       return NextResponse.json(
//         { error: 'Application with this name already exists' },
//         { status: 409 }
//       );
//     }

//     // Parse repository URL to extract owner/repo
//     const repoUrl = spec.source.repoURL;
//     let gitRepository;

//     try {
//       const url = new URL(repoUrl);
//       const pathParts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
//       if (pathParts.length >= 2) {
//         gitRepository = {
//           owner: pathParts[pathParts.length - 2],
//           repo: pathParts[pathParts.length - 1],
//           branch: spec.source.targetRevision || 'main',
//           path: spec.taskDefinitionPath
//         };
//       } else {
//         throw new Error('Invalid repository URL format');
//       }
//     } catch {
//       return NextResponse.json(
//         { error: 'Invalid repository URL format' },
//         { status: 400 }
//       );
//     }

//     // Create application in database
//     const dbApplication = await db.createApplication({
//       name,
//       gitRepository,
//       ecsCluster: metadata.labels['ecscd.io/cluster'],
//       ecsService: metadata.labels['ecscd.io/service'],
//       taskDefinitionPath: spec.taskDefinitionPath,
//       autoSync: false,
//       syncPolicy: {
//         automated: false,
//         selfHeal: false,
//         prune: false
//       },
//       awsConfig: spec.awsConfig ? {
//         region: spec.awsConfig.region,
//         roleArn: spec.awsConfig.roleArn,
//         externalId: spec.awsConfig.externalId,
//         sessionName: spec.awsConfig.sessionName
//       } : undefined
//     });

//     // Create initial sync status
//     await db.createOrUpdateSyncStatus({
//       applicationId: dbApplication.id,
//       status: 'OutOfSync',
//       revision: ''
//     });

//     // Create initial application status
//     await db.createOrUpdateApplicationStatus({
//       applicationId: dbApplication.id,
//       health: 'Unknown'
//     });

//     const newApplication: Application = {
//       metadata: {
//         name,
//         labels: {
//           'app.kubernetes.io/name': name,
//           ...metadata.labels
//         }
//       },
//       spec: {
//         name,
//         gitRepository,
//         ecsCluster: metadata.labels['ecscd.io/cluster'],
//         ecsService: metadata.labels['ecscd.io/service'],
//         taskDefinitionPath: spec.taskDefinitionPath,
//         autoSync: false,
//         syncPolicy: {
//           automated: false,
//           selfHeal: false,
//           prune: false
//         },
//         awsConfig: spec.awsConfig ? {
//           region: spec.awsConfig.region,
//           roleArn: spec.awsConfig.roleArn,
//           externalId: spec.awsConfig.externalId,
//           sessionName: spec.awsConfig.sessionName
//         } : undefined
//       },
//       status: {
//         health: 'Unknown',
//         sync: {
//           status: 'OutOfSync',
//           revision: ''
//         }
//       }
//     };

//     return NextResponse.json({ application: newApplication }, { status: 201 });
//   } catch (error) {
//     console.error('Error creating application:', error);
//     return NextResponse.json(
//       { error: 'Failed to create application' },
//       { status: 500 }
//     );
//   }
// }

// export async function DELETE(request: NextRequest) {
//   try {
//     const { searchParams } = new URL(request.url);
//     const name = searchParams.get('name');

//     if (!name) {
//       return NextResponse.json(
//         { error: 'Application name is required' },
//         { status: 400 }
//       );
//     }

//     // Check if application exists
//     const existingApp = await db.getApplicationByName(name);
//     if (!existingApp) {
//       return NextResponse.json(
//         { error: 'Application not found' },
//         { status: 404 }
//       );
//     }

//     // Delete all related data first
//     await db.deleteSyncStatus(existingApp.id);
//     await db.deleteApplicationStatus(existingApp.id);

//     // Delete all deployments and their events
//     const deployments = await db.getDeploymentsByApplication(existingApp.id);
//     for (const deployment of deployments) {
//       await db.deleteDeploymentEvents(deployment.id);
//       await db.deleteDeployment(deployment.id);
//     }

//     // Finally delete the application
//     const deleted = await db.deleteApplication(existingApp.id);

//     if (!deleted) {
//       return NextResponse.json(
//         { error: 'Failed to delete application' },
//         { status: 500 }
//       );
//     }

//     return NextResponse.json({ message: 'Application deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting application:', error);
//     return NextResponse.json(
//       { error: 'Failed to delete application' },
//       { status: 500 }
//     );
//   }
// }
