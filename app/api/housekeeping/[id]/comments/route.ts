import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal, NotFoundError, CrossTenantViolationError } from "@/lib/dal";
import { z } from "zod";

const createCommentSchema = z.object({
  body: z.string().min(1, "Comment body is required"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requirePermission("housekeeping.view");

    const comments = await dal.housekeeping.getComments(
      { organizationId: user.organizationId! },
      id,
    );

    return NextResponse.json({ success: true, data: comments });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 404 });
    }
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load comments" } }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requirePermission("housekeeping.manage");

    const raw = await request.json();
    const parsed = createCommentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid comment payload", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const comment = await dal.housekeeping.addComment(
      { organizationId: user.organizationId! },
      id,
      parsed.data.body,
      user.id,
    );

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 404 });
    }
    if (error instanceof CrossTenantViolationError) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    }
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to add comment" } }, { status });
  }
}
