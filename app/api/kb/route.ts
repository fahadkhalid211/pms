import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { createKnowledgeBaseDocument } from "@/lib/kb";

const createDocSchema = z.object({
  propertyId: z.string().optional().nullable(),
  type: z.enum(["faq", "policy", "amenity_guide", "local_guide", "sop"]).default("faq"),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  source: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("ai.chatbot.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    const documents = await prisma.knowledgeBaseDocument.findMany({
      where: {
        organizationId,
        ...(propertyId ? { propertyId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        chunks: { select: { id: true, chunkIndex: true, tokenCount: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load knowledge base" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("ai.chatbot.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = createDocSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid document data." } },
        { status: 400 },
      );
    }

    const document = await createKnowledgeBaseDocument({
      organizationId,
      propertyId: parsed.data.propertyId,
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content,
      source: parsed.data.source,
      userId: user.id,
    });

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to create document" } }, { status: 400 });
  }
}
