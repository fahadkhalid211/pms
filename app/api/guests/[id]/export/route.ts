import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { exportCustomerArchive } from "@/lib/retention";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission("guests.view");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { id } = await params;
    const archive = await exportCustomerArchive(organizationId, id);

    return new Response(JSON.stringify(archive, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="customer-archive-${id}.json"`,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Export failed" } }, { status: 500 });
  }
}
