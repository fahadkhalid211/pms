import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { purgeRetentionLogs } from "@/lib/retention";

const purgeSchema = z.object({
  daysToKeep: z.number().int().min(7).max(365).default(90),
  dryRun: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission("settings.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = purgeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid payload" } },
        { status: 400 },
      );
    }

    const result = await purgeRetentionLogs({
      organizationId,
      daysToKeep: parsed.data.daysToKeep,
      dryRun: parsed.data.dryRun,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Retention purge failed" } }, { status: 500 });
  }
}
