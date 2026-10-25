import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const updatePropertySchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).max(10).optional(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  checkInTime: z.number().int().min(0).max(23).optional(),
  checkOutTime: z.number().int().min(0).max(23).optional(),
  taxRate: z.number().min(0).optional(),
  cleaningFee: z.number().min(0).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("properties.view", { propertyId: id });
    const property = await dal.properties.findUnique({ organizationId: user.organizationId! }, id);
    return NextResponse.json({ success: true, data: property });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to fetch property" } }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("properties.manage", { propertyId: id });
    const rawBody = await request.json();
    const parsed = updatePropertySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid property payload" } },
        { status: 400 },
      );
    }

    const updated = await dal.properties.update(
      { organizationId: user.organizationId! },
      id,
      parsed.data as any,
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update property" } }, { status });
  }
}
