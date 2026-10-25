import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const CreateDiscountSchema = z.object({
  code: z.string().min(1, "Discount code is required").max(30),
  type: z.enum(["percent", "fixed"]).optional().default("percent"),
  value: z.union([z.string(), z.number()]).refine((val) => Number(val) > 0, "value must be positive"),
  propertyId: z.string().optional().nullable(),
  maxRedemptions: z.coerce.number().int().min(0).optional().default(0),
  validFrom: z.string().or(z.date()).optional().nullable(),
  validTo: z.string().or(z.date()).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("rates.view", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || undefined;
    const code = searchParams.get("code") || undefined;

    if (code) {
      const discount = await dal.discounts.findByCode({ organizationId: user.organizationId }, code, propertyId);
      return NextResponse.json({ success: true, data: discount });
    }

    const discounts = await dal.discounts.findMany({ organizationId: user.organizationId }, propertyId);
    return NextResponse.json({ success: true, data: discounts });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to fetch discounts" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("rates.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = CreateDiscountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const discount = await dal.discounts.create(
      { organizationId: user.organizationId },
      parsed.data,
    );

    return NextResponse.json({ success: true, data: discount }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create discount" } }, { status });
  }
}
