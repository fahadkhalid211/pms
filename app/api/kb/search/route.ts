import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { searchKnowledgeBase } from "@/lib/kb";

const searchSchema = z.object({
  query: z.string().min(1, "Query is required"),
  propertyId: z.string().optional().nullable(),
  limit: z.number().int().positive().default(5),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission("ai.chatbot.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid search query" } },
        { status: 400 },
      );
    }

    const results = await searchKnowledgeBase(organizationId, parsed.data.query, {
      propertyId: parsed.data.propertyId,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Knowledge search failed" } }, { status: 500 });
  }
}
