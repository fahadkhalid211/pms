import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { chunkText } from "@/lib/kb";
import { logActivity } from "@/lib/audit";

const patchDocSchema = z.object({
  title: z.string().optional(),
  type: z.enum(["faq", "policy", "amenity_guide", "local_guide", "sop"]).optional(),
  content: z.string().optional(),
  status: z.enum(["active", "archived", "draft"]).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.chatbot.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { id } = await params;
    const document = await prisma.knowledgeBaseDocument.findFirst({
      where: { id, organizationId },
      include: {
        chunks: { orderBy: { chunkIndex: "asc" } },
        property: { select: { id: true, name: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ success: false, error: { message: "Document not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: document });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load document" } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.chatbot.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { id } = await params;
    const existing = await prisma.knowledgeBaseDocument.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Document not found" } }, { status: 404 });
    }

    const body = await request.json();
    const parsed = patchDocSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid update payload" } },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.knowledgeBaseDocument.update({
        where: { id },
        data: {
          title: data.title,
          type: data.type,
          content: data.content,
          status: data.status,
        },
      });

      // If content was modified, re-index chunks
      if (data.content && data.content !== existing.content) {
        await tx.knowledgeBaseChunk.deleteMany({ where: { documentId: id } });
        const newChunks = chunkText(data.content);
        for (let i = 0; i < newChunks.length; i++) {
          await tx.knowledgeBaseChunk.create({
            data: {
              organizationId,
              documentId: id,
              chunkIndex: i,
              content: newChunks[i],
              tokenCount: Math.ceil(newChunks[i].length / 4),
            },
          });
        }
      }

      return doc;
    });

    await logActivity({
      organizationId,
      userId: user.id,
      source: "backend",
      category: "ai",
      action: "kb.document_updated",
      summary: `Updated KB document '${updated.title}'.`,
      entityType: "KnowledgeBaseDocument",
      entityId: updated.id,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to update document" } }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.chatbot.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { id } = await params;
    const existing = await prisma.knowledgeBaseDocument.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Document not found" } }, { status: 404 });
    }

    await prisma.knowledgeBaseDocument.delete({ where: { id } });

    await logActivity({
      organizationId,
      userId: user.id,
      source: "backend",
      category: "ai",
      action: "kb.document_deleted",
      summary: `Deleted KB document '${existing.title}'.`,
      entityType: "KnowledgeBaseDocument",
      entityId: existing.id,
    });

    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to delete document" } }, { status: 500 });
  }
}
