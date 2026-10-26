import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { runAgent } from "@/lib/ai/agent";

const executeSchema = z.object({
  message: z.string().min(1, "Message is required"),
  propertyId: z.string().optional().nullable(),
  executionId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission("ai.operate");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Tenant organization context required." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = executeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid request body." } },
        { status: 400 },
      );
    }

    const outcome = await runAgent({
      message: parsed.data.message,
      userId: user.id,
      organizationId,
      propertyId: parsed.data.propertyId,
      executionId: parsed.data.executionId,
    });

    return NextResponse.json({ success: true, data: outcome });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "AI agent execution failed." } }, { status: 500 });
  }
}
