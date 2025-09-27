import { NextRequest, NextResponse } from "next/server";
import { ApplicationDomain } from "@/lib/domain/application";
import { au, du } from "@/lib/di";

export async function GET(
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
    const diffs = await du.diff(application);
    return NextResponse.json({ diffs }, { status: 200 });
  } catch (error) {
    console.error("Error fetching diffs:", error);
    return NextResponse.json(
      { error: "Failed to fetch diffs" },
      { status: 500 }
    );
  }
}
