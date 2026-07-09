import { au } from "@/lib/di";
import { NextRequest, NextResponse } from "next/server";

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
    const application = await au.getApplication(name);
    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }
    const resolvedApplication = await au.observeApplication(application);
    return NextResponse.json(
      {
        service:
          resolvedApplication.service.status === "Success"
            ? resolvedApplication.service.value
            : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching diffs:", error);
    return NextResponse.json(
      { error: "Failed to fetch diffs" },
      { status: 500 }
    );
  }
}
