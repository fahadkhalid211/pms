import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const processSchema = z.object({
  limit: z.number().int().positive().max(50).default(10),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission("notifications.manage");
    let limit = 10;
    try {
      const body = await request.json();
      const parsed = processSchema.safeParse(body);
      if (parsed.success) {
        limit = parsed.data.limit;
      }
    } catch {
      // Body is optional
    }

    const result = await dal.notifications.processQueue(
      { organizationId: user.organizationId! },
      limit,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to process notifications queue" } },
      { status },
    );
  }
}
