import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const CreateRatePlanSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  name: z.string().min(1, "Rate plan name is required"),
  type: z.enum(["fixed", "percentage_modifier", "seasonal"]).optional().default("fixed"),
  amount: z.union([z.string(), z.number()]).refine((val) => Number(val) >= 0, "amount must be non-negative"),
  currency: z.string().optional().default("USD"),
  isActive: z.boolean().optional().default(true),
  seasons: z
    .array(
      z.object({
        startDate: z.string().or(z.date()),
        endDate: z.string().or(z.date()),
        amount: z.union([z.string(), z.number()]).refine((val) => Number(val) >= 0),
      }),
    )
    .optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("rates.view", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || undefined;

    const plans = await dal.ratePlans.findMany(
      { organizationId: user.organizationId },
      propertyId,
    );

    return NextResponse.json({ success: true, data: plans });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to fetch rate plans" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("rates.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = CreateRatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const plan = await dal.ratePlans.create(
      { organizationId: user.organizationId },
      parsed.data,
    );

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create rate plan" } }, { status });
  }
}
