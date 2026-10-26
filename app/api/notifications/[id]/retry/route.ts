import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requirePermission("notifications.manage");
    const notification = await dal.notifications.retry(
      { organizationId: user.organizationId! },
      id,
    );

    return NextResponse.json({ success: true, data: notification });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to retry notification" } },
      { status },
    );
  }
}
