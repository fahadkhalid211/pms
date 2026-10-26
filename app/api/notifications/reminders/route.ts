import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const remindersSchema = z.object({
  type: z.enum(["pre_arrival", "check_in", "check_out", "payment", "all"]).default("all"),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission("notifications.manage");
    let type: "pre_arrival" | "check_in" | "check_out" | "payment" | "all" = "all";
    try {
      const raw = await request.json();
      const parsed = remindersSchema.safeParse(raw);
      if (parsed.success) {
        type = parsed.data.type;
      }
    } catch {
      // Body is optional
    }

    const results = await dal.notifications.runReminders(
      { organizationId: user.organizationId! },
      type,
    );

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to run reminders" } },
      { status },
    );
  }
}
