import { NextRequest, NextResponse } from "next/server";
import { createContainer } from "@/lib/di";

export async function GET() {
  try {
    const { filterUsecase } = createContainer();
    const filters = await filterUsecase.getFilters();
    return NextResponse.json({ filters });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json(
      { error: "Failed to fetch filters" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, pattern } = body;

    if (!name || !pattern) {
      return NextResponse.json(
        { error: "name and pattern are required" },
        { status: 400 }
      );
    }

    const { filterUsecase } = createContainer();
    const filter = await filterUsecase.createFilter(name, pattern);
    return NextResponse.json({ filter }, { status: 201 });
  } catch (error) {
    console.error("Error creating filter:", error);
    return NextResponse.json(
      { error: "Failed to create filter" },
      { status: 500 }
    );
  }
}
