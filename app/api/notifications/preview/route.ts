import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { renderTemplate } from "@/lib/notifications/templates";
import { dal } from "@/lib/dal";
import { z } from "zod";

const previewSchema = z.object({
  templateCode: z.enum([
    "pre_arrival",
    "check_in_welcome",
    "check_out_thanks",
    "payment_receipt",
    "payment_reminder",
  ]),
  propertyId: z.string().optional(),
  variables: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission("notifications.view");
    const raw = await request.json();
    const parsed = previewSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid preview payload" } },
        { status: 400 },
      );
    }

    let brand = undefined;
    if (parsed.data.propertyId) {
      try {
        const prop = await dal.properties.findUnique(
          { organizationId: user.organizationId! },
          parsed.data.propertyId,
        );
        if (prop) {
          brand = {
            name: prop.name,
            address: [prop.addressLine1, prop.city, prop.state, prop.postalCode].filter(Boolean).join(", "),
            phone: prop.phone ?? undefined,
            email: prop.email ?? undefined,
            brandColor: "#0ea5e9",
          };
        }
      } catch {
        // Fall back to default branding
      }
    }

    const defaultMockVars: Record<string, any> = {
      guestName: "Eleanor Vance",
      bookingCode: "RES-98241",
      checkInDate: "2026-11-01",
      checkOutDate: "2026-11-05",
      roomType: "Deluxe Ocean Suite",
      roomNumber: "402",
      wifiSsid: "Lumina-Guest",
      wifiPassword: "StayLumina2026",
      invoiceNumber: "INV-2026-0042",
      amountPaid: "$1,250.00",
      paymentMethod: "Credit Card (Visa •••• 4242)",
      paymentDate: "2026-10-26",
      balanceRemaining: "$0.00",
      amountDue: "$420.00",
      dueDate: "2026-10-30",
      ...(parsed.data.variables ?? {}),
    };

    const rendered = renderTemplate(parsed.data.templateCode, defaultMockVars, brand);

    return NextResponse.json({ success: true, data: rendered });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to preview template" } },
      { status },
    );
  }
}
