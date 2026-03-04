import { NextRequest, NextResponse } from "next/server";
import { createContainer } from "@/lib/di";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const namesOnly = searchParams.get("namesOnly") === "true";
    const filter = searchParams.get("filter");
    const { applicationUsecase } = createContainer();

    if (namesOnly) {
      let names = await applicationUsecase.getApplicationNames();

      if (filter && filter.trim()) {
        const filterLower = filter.toLowerCase();
        names = names.filter((name) =>
          name.toLowerCase().includes(filterLower)
        );
      }

      return NextResponse.json({ names });
    }

    let applications = await applicationUsecase.getApplications();

    if (filter && filter.trim()) {
      const filterLower = filter.toLowerCase();
      applications = applications.filter((app) =>
        app.name.toLowerCase().includes(filterLower)
      );
    }

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

    const { applicationUsecase } = createContainer();

    // Check if application with same name already exists
    const existingApps = await applicationUsecase.getApplications();
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
    await applicationUsecase.createApplication(newApp);
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

