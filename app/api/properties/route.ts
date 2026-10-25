import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requirePermission("properties.view");
    const properties = await prisma.property.findMany({
      where: { organizationId: user.organizationId ?? "" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, city: true, country: true, status: true, currency: true, timezone: true },
    });
    return NextResponse.json({ success: true, data: properties });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load properties" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("properties.manage");
    const body = await request.json();
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }
    const property = await prisma.property.create({
      data: {
        organizationId: user.organizationId,
        name: body.name,
        code: body.code ?? "PROP",
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        country: body.country,
        phone: body.phone,
        email: body.email,
        timezone: body.timezone ?? "UTC",
        currency: body.currency ?? "USD",
        checkInTime: body.checkInTime ?? 15,
        checkOutTime: body.checkOutTime ?? 11,
        taxRate: body.taxRate ?? 0,
        cleaningFee: body.cleaningFee ?? 0,
        description: body.description,
        status: "active",
      },
    });
    return NextResponse.json({ success: true, data: property }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create property" } }, { status: 400 });
  }
}
