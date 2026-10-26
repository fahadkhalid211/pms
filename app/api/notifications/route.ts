import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const enqueueSchema = z.object({
  propertyId: z.string().optional().nullable(),
  guestId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  channel: z.enum(["email", "sms", "in_app", "webhook"]).default("email"),
  type: z.string().min(1, "Type is required"),
  templateCode: z.string().optional(),
  toEmail: z.string().email().optional().nullable(),
  toPhone: z.string().optional().nullable(),
  subject: z.string().optional(),
  variables: z.record(z.any()).optional(),
  relatedType: z.string().optional().nullable(),
  relatedId: z.string().optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("notifications.view");
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const channel = url.searchParams.get("channel") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;

    const list = await dal.notifications.findMany(
      { organizationId: user.organizationId! },
      { propertyId, status, channel, type },
    );

    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to load notifications" } },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("notifications.manage");
    const rawBody = await request.json();
    const parsed = enqueueSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid notification payload" } },
        { status: 400 },
      );
    }

    const res = await dal.notifications.enqueue(
      { organizationId: user.organizationId! },
      {
        ...parsed.data,
        scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
      },
    );

    return NextResponse.json({ success: true, data: res }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to enqueue notification" } },
      { status },
    );
  }
}
