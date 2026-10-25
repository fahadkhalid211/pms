import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requirePermission("integrations.manage");
    const integrations = await prisma.integration.findMany({
      where: { organizationId: user.organizationId ?? "" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { property: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, data: integrations });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load integrations" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("integrations.manage");
    const body = await request.json();
    const integration = await prisma.integration.create({
      data: {
        organizationId: user.organizationId ?? "",
        propertyId: body.propertyId ?? null,
        provider: body.provider,
        name: body.name,
        status: body.status ?? "pending",
        config: body.config,
      },
    });
    return NextResponse.json({ success: true, data: integration }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create integration" } }, { status: 400 });
  }
}
