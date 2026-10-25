import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const SetupWizardSchema = z.object({
  property: z.object({
    name: z.string().min(1, "Property name is required"),
    code: z.string().optional().default("PROP"),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    currency: z.string().optional().default("USD"),
    timezone: z.string().optional().default("UTC"),
    checkInTime: z.coerce.number().min(0).max(23).optional().default(15),
    checkOutTime: z.coerce.number().min(0).max(23).optional().default(11),
    taxRate: z.union([z.string(), z.number()]).optional().default(0),
    cleaningFee: z.union([z.string(), z.number()]).optional().default(0),
  }),
  roomTypes: z
    .array(
      z.object({
        name: z.string().min(1, "Room type name is required"),
        capacity: z.coerce.number().int().min(1).default(2),
        bedType: z.string().optional().default("King"),
        baseRate: z.union([z.string(), z.number()]).refine((val) => Number(val) >= 0),
      }),
    )
    .min(1, "At least one room type is required"),
  rooms: z
    .array(
      z.object({
        number: z.string().min(1, "Room number is required"),
        floor: z.string().optional().default("1"),
        roomTypeName: z.string().min(1, "roomTypeName is required"),
      }),
    )
    .min(1, "At least one room is required"),
  ratePlans: z
    .array(
      z.object({
        name: z.string().min(1, "Rate plan name is required"),
        amount: z.union([z.string(), z.number()]).refine((val) => Number(val) >= 0),
        type: z.enum(["fixed", "percentage_modifier", "seasonal"]).optional().default("fixed"),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission("properties.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = SetupWizardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const result = await dal.onboarding.setupProperty(
      { organizationId: user.organizationId },
      parsed.data,
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Setup wizard failed" } }, { status });
  }
}
