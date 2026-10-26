import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const updatePrefsSchema = z.object({
  guestId: z.string().min(1, "Guest ID is required"),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  preArrivalReminders: z.boolean().optional(),
  checkInReminders: z.boolean().optional(),
  checkOutReminders: z.boolean().optional(),
  paymentReminders: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("notifications.view");
    const url = new URL(request.url);
    const guestId = url.searchParams.get("guestId") ?? undefined;
    const userId = url.searchParams.get("userId") ?? undefined;

    const prefs = await dal.notifications.getPreferences(
      { organizationId: user.organizationId! },
      guestId,
      userId,
    );

    return NextResponse.json({ success: true, data: prefs });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to fetch preferences" } },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("notifications.manage");
    const raw = await request.json();
    const parsed = updatePrefsSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid preferences payload" } },
        { status: 400 },
      );
    }

    const { guestId, ...updates } = parsed.data;
    const result = await dal.notifications.updatePreferences(
      { organizationId: user.organizationId! },
      guestId,
      updates,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to update preferences" } },
      { status },
    );
  }
}
