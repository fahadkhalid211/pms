import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { runAgent } from "@/lib/ai/agent";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("ai.operate");
    const body = await request.json();
    const message: string = body.message;
    const propertyId = body.propertyId ?? null;
    const outcome = await runAgent({
      message,
      userId: user.id,
      organizationId: user.organizationId ?? "",
      propertyId,
    });
    return NextResponse.json({ success: true, data: outcome });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "AI agent failed" } }, { status: 500 });
  }
}
