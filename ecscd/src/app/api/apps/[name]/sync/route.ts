import { NextRequest, NextResponse } from "next/server";
import { ApplicationDomain } from "@/lib/domain/application";
import { au, du } from "@/lib/di";

export async function POST(
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
    // Check if application with the given name exists
    const existingApps = await au.getApplications();
    const appIndex = existingApps.findIndex((app) => app.name === name);
    if (appIndex === -1) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const application: ApplicationDomain = existingApps[appIndex];
    await du.syncService(application);
    return NextResponse.json(
      { message: "Service synchronized successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error synchronizing service:", error);
    return NextResponse.json(
      { error: "Failed to synchronize service" },
      { status: 500 }
    );
  }
}
