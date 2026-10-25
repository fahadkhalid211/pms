import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requirePermission("ai.chatbot.manage");
    const documents = await prisma.knowledgeBaseDocument.findMany({
      where: { organizationId: user.organizationId ?? "" },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    const conversations = await prisma.chatbotConversation.findMany({
      where: { organizationId: user.organizationId ?? "" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
    });
    return NextResponse.json({ success: true, data: { documents, conversations } });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load knowledge base" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("ai.chatbot.manage");
    const body = await request.json();
    const document = await prisma.knowledgeBaseDocument.create({
      data: {
        organizationId: user.organizationId ?? "",
        propertyId: body.propertyId ?? null,
        type: body.type ?? "faq",
        title: body.title,
        content: body.content,
        source: body.source,
        status: body.status ?? "active",
      },
    });
    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create document" } }, { status: 400 });
  }
}
