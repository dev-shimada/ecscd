import { NextRequest, NextResponse } from "next/server";
import { au, du } from "@/lib/di";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    if (!name) {
      return NextResponse.json(
        { error: "Missing application name" },
        { status: 400 }
      );
    }

    const application = await au.getApplication(name);
    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    let diffs = [];
    let diffError: string | undefined;

    if (
      application.sync.status !== "Error" &&
      application.service &&
      application.service.status === "ACTIVE"
    ) {
      try {
        diffs = await du.diff(application);
      } catch (error) {
        diffError =
          error instanceof Error
            ? error.message
            : "Failed to load configuration diff.";
      }
    } else if (application.reason) {
      diffError = application.reason;
    }

    return NextResponse.json({
      application,
      diff: {
        diffs,
        summary: `${diffs.length} changes`,
        error: diffError,
      },
    });
  } catch (error) {
    console.error("Error fetching application:", error);
    return NextResponse.json(
      { error: "Failed to fetch application" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const body = await request.json();
    const { gitConfig, ecsConfig, awsConfig } = body;
    const { name } = await params;
    if (!name || !gitConfig || !ecsConfig || !awsConfig) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const existingApp = await au.getApplicationConfig(name);
    if (!existingApp) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const updatedApp = {
      ...existingApp,
      name,
      gitConfig,
      ecsConfig,
      awsConfig,
      updatedAt: new Date(),
    };
    await au.updateApplication(updatedApp);
    return NextResponse.json(
      { message: "Application updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating application:", error);
    return NextResponse.json(
      { error: "Failed to update application" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    if (!name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    const existingApp = await au.getApplicationConfig(name);
    if (!existingApp) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    await au.deleteApplication(name);
    return NextResponse.json(
      { message: "Application deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting application:", error);
    return NextResponse.json(
      { error: "Failed to delete application" },
      { status: 500 }
    );
  }
}
