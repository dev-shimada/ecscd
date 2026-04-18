import { au } from "@/lib/di";
import * as Applications from "@/lib/domain/application";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    if (!name) {
      return NextResponse.json(
        { error: "Missing application name" },
        { status: 400 },
      );
    }

    const application = await au.getApplication(name);
    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(await au.observeApplication(application));
  } catch (error) {
    console.error("Error fetching application:", error);
    return NextResponse.json(
      { error: "Failed to fetch application" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const body = await request.json();
    const { gitConfig, ecsConfig, awsConfig } = body;
    const { name } = await params;
    if (!name || !gitConfig || !ecsConfig || !awsConfig) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const existingApp = await au.getApplication(name);
    if (!existingApp) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    const updatedApp = Applications.updateSettings(existingApp, {
      gitConfig,
      ecsConfig,
      awsConfig,
      now: new Date(),
    });
    await au.updateApplication(updatedApp);
    return NextResponse.json(
      { message: "Application updated successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating application:", error);
    return NextResponse.json(
      { error: "Failed to update application" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    if (!name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }
    const existingApp = await au.getApplication(name);
    if (!existingApp) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    await au.deleteApplication(name);
    return NextResponse.json(
      { message: "Application deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting application:", error);
    return NextResponse.json(
      { error: "Failed to delete application" },
      { status: 500 },
    );
  }
}
