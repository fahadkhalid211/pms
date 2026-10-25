import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const CreatePropertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  code: z.string().optional().default("PROP"),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  timezone: z.string().optional().default("UTC"),
  currency: z.string().optional().default("USD"),
  checkInTime: z.coerce.number().min(0).max(23).optional().default(15),
  checkOutTime: z.coerce.number().min(0).max(23).optional().default(11),
  taxRate: z.coerce.number().min(0).optional().default(0),
  cleaningFee: z.coerce.number().min(0).optional().default(0),
  description: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("properties.view", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }
    const properties = await dal.properties.findMany({ organizationId: user.organizationId });
    return NextResponse.json({ success: true, data: properties });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.status === 401 || error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load properties" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("properties.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }
    const body = await request.json();
    const parsed = CreatePropertySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const property = await dal.properties.create(
      { organizationId: user.organizationId },
      {
        name: parsed.data.name,
        code: parsed.data.code,
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2,
        city: parsed.data.city,
        state: parsed.data.state,
        postalCode: parsed.data.postalCode,
        country: parsed.data.country,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        timezone: parsed.data.timezone,
        currency: parsed.data.currency,
        checkInTime: parsed.data.checkInTime,
        checkOutTime: parsed.data.checkOutTime,
        taxRate: parsed.data.taxRate,
        cleaningFee: parsed.data.cleaningFee,
        description: parsed.data.description,
      },
    );

    return NextResponse.json({ success: true, data: property }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.status === 401 || error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create property" } }, { status: 400 });
  }
}
