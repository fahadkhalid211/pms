import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { calculateStayPrice } from "@/lib/pricing/engine";

const PricingQuoteSchema = z.object({
  roomTypeId: z.string().min(1, "roomTypeId is required"),
  checkIn: z.string().min(1, "checkIn date is required"),
  checkOut: z.string().min(1, "checkOut date is required"),
  ratePlanId: z.string().optional().nullable(),
  discountCode: z.string().optional().nullable(),
  adults: z.coerce.number().int().min(1).optional().default(1),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    if (!auth.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = PricingQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const ctx = { organizationId: auth.organizationId };

    // 1. Fetch RoomType and parent Property
    const roomType = await dal.roomTypes.findUnique(ctx, parsed.data.roomTypeId);
    const property = await dal.properties.findUnique(ctx, roomType.propertyId);

    // 2. Fetch RatePlan if provided
    let ratePlan = null;
    if (parsed.data.ratePlanId) {
      ratePlan = await dal.ratePlans.findUnique(ctx, parsed.data.ratePlanId);
    }

    // 3. Fetch Discount if code provided
    let discount = null;
    if (parsed.data.discountCode) {
      const foundDiscount = await dal.discounts.findByCode(ctx, parsed.data.discountCode, property.id);
      if (foundDiscount) {
        discount = {
          code: foundDiscount.code,
          type: foundDiscount.type as "percent" | "fixed",
          value: foundDiscount.value,
        };
      }
    }

    // 4. Calculate exact price breakdown using Decimal math
    const quote = calculateStayPrice({
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
      baseRate: roomType.baseRate,
      ratePlan: ratePlan
        ? {
            id: ratePlan.id,
            name: ratePlan.name,
            amount: ratePlan.amount,
            seasons: ratePlan.seasons.map((s) => ({
              id: s.id,
              startDate: s.startDate,
              endDate: s.endDate,
              amount: s.amount,
            })),
          }
        : null,
      discount,
      taxRatePercent: property.taxRate,
      cleaningFee: property.cleaningFee,
      adults: parsed.data.adults,
      capacity: roomType.capacity,
    });

    return NextResponse.json({
      success: true,
      data: {
        property: {
          id: property.id,
          name: property.name,
          currency: property.currency,
          timezone: property.timezone,
        },
        roomType: {
          id: roomType.id,
          name: roomType.name,
          capacity: roomType.capacity,
          bedType: roomType.bedType,
        },
        ...quote,
      },
    });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to calculate pricing quote" } }, { status });
  }
}
