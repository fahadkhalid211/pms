import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("properties.manage");
    const { id } = await params;
    const body = await request.json();
    const property = await prisma.property.update({
      where: { id },
      data: {
        name: body.name,
        addressLine1: body.addressLine1,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        country: body.country,
        phone: body.phone,
        email: body.email,
        timezone: body.timezone,
        currency: body.currency,
        checkInTime: body.checkInTime,
        checkOutTime: body.checkOutTime,
        taxRate: body.taxRate,
        cleaningFee: body.cleaningFee,
        description: body.description,
        status: body.status,
      },
    });
    return NextResponse.json({ success: true, data: property });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update property" } }, { status: 500 });
  }
}
