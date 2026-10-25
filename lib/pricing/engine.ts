import { Prisma } from "@prisma/client";

export interface PricingNightBreakdown {
  date: string; // 'YYYY-MM-DD'
  baseRate: string; // e.g. "150.00"
  rateApplied: string; // e.g. "180.00"
  rateSource: string; // "Room Type Base Rate" | "Rate Plan: Standard" | "Seasonal: Summer Peak"
}

export interface PricingCalculationRequest {
  checkIn: string | Date;
  checkOut: string | Date;
  baseRate: Prisma.Decimal | string | number;
  ratePlan?: {
    id?: string;
    name: string;
    amount: Prisma.Decimal | string | number;
    seasons?: Array<{
      id?: string;
      startDate: Date | string;
      endDate: Date | string;
      amount: Prisma.Decimal | string | number;
      name?: string;
    }>;
  } | null;
  discount?: {
    code: string;
    type: "percent" | "fixed";
    value: Prisma.Decimal | string | number;
  } | null;
  taxRatePercent?: Prisma.Decimal | string | number; // e.g. 10.0 for 10%
  cleaningFee?: Prisma.Decimal | string | number; // e.g. 50.00
  adults?: number;
  capacity?: number;
  extraGuestFeePerNight?: Prisma.Decimal | string | number;
}

export interface PricingCalculationResult {
  nightsCount: number;
  nightlyBreakdown: PricingNightBreakdown[];
  nightlySubtotal: string;
  extraGuestFees: string;
  accommodationSubtotal: string;
  discountCode?: string;
  discountAmount: string;
  netAccommodationTotal: string;
  cleaningFee: string;
  taxableAmount: string;
  taxRatePercent: string;
  taxAmount: string;
  grandTotal: string;
  decimalBreakdown: {
    nightlySubtotal: Prisma.Decimal;
    extraGuestFees: Prisma.Decimal;
    accommodationSubtotal: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    netAccommodationTotal: Prisma.Decimal;
    cleaningFee: Prisma.Decimal;
    taxableAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
  };
}

/**
 * Normalizes a Date or string to a local midnight Date without time skew.
 */
function toMidnightDate(d: Date | string): Date {
  if (typeof d === "string") {
    // If 'YYYY-MM-DD', parse parts to avoid timezone shifting
    const parts = d.split("T")[0].split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(Date.UTC(year, month, day));
    }
  }
  const dateObj = new Date(d);
  return new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));
}

function formatDateString(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculates exact stay price and tax using Decimal half-up arithmetic.
 * Never performs floating point operations on money.
 */
export function calculateStayPrice(req: PricingCalculationRequest): PricingCalculationResult {
  const start = toMidnightDate(req.checkIn);
  const end = toMidnightDate(req.checkOut);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid check-in or check-out date.");
  }

  const msDiff = end.getTime() - start.getTime();
  const nightsCount = Math.round(msDiff / (1000 * 60 * 60 * 24));

  if (nightsCount <= 0) {
    throw new Error("Check-out date must be strictly after check-in date (minimum 1 night stay required).");
  }

  const baseRateDec = new Prisma.Decimal(req.baseRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const ratePlanAmountDec = req.ratePlan ? new Prisma.Decimal(req.ratePlan.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : null;

  let nightlySubtotal = new Prisma.Decimal(0);
  const nightlyBreakdown: PricingNightBreakdown[] = [];

  // Iterate each night
  const cur = new Date(start.getTime());
  for (let i = 0; i < nightsCount; i++) {
    const nightDateStr = formatDateString(cur);
    const nightTime = cur.getTime();

    let appliedRate = ratePlanAmountDec !== null && !ratePlanAmountDec.isZero() ? ratePlanAmountDec : baseRateDec;
    let rateSource = req.ratePlan?.name ? `Rate Plan: ${req.ratePlan.name}` : "Room Type Base Rate";

    // Check for applicable seasonal rate in rate plan
    if (req.ratePlan?.seasons && req.ratePlan.seasons.length > 0) {
      for (const season of req.ratePlan.seasons) {
        const sStart = toMidnightDate(season.startDate).getTime();
        const sEnd = toMidnightDate(season.endDate).getTime();
        if (nightTime >= sStart && nightTime <= sEnd) {
          appliedRate = new Prisma.Decimal(season.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          rateSource = season.name ? `Seasonal Rate: ${season.name}` : `Seasonal Rate (${formatDateString(new Date(sStart))} - ${formatDateString(new Date(sEnd))})`;
          break;
        }
      }
    }

    nightlySubtotal = nightlySubtotal.plus(appliedRate);
    nightlyBreakdown.push({
      date: nightDateStr,
      baseRate: baseRateDec.toFixed(2),
      rateApplied: appliedRate.toFixed(2),
      rateSource,
    });

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Extra guest surcharge
  const adults = req.adults ?? 1;
  const capacity = req.capacity ?? 2;
  const extraGuests = Math.max(0, adults - capacity);
  const extraFeePerNight = new Prisma.Decimal(req.extraGuestFeePerNight ?? 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const extraGuestFees = extraFeePerNight.times(extraGuests).times(nightsCount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const accommodationSubtotal = nightlySubtotal.plus(extraGuestFees);

  // Discount calculation
  let discountAmount = new Prisma.Decimal(0);
  if (req.discount && req.discount.value) {
    const discVal = new Prisma.Decimal(req.discount.value);
    if (req.discount.type === "percent") {
      const clampedPercent = Prisma.Decimal.min(new Prisma.Decimal(100), Prisma.Decimal.max(new Prisma.Decimal(0), discVal));
      discountAmount = accommodationSubtotal.times(clampedPercent).dividedBy(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    } else {
      // Fixed discount capped at accommodation subtotal
      discountAmount = Prisma.Decimal.min(accommodationSubtotal, discVal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }
  }

  const netAccommodationTotal = accommodationSubtotal.minus(discountAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const cleaningFee = new Prisma.Decimal(req.cleaningFee ?? 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // Tax calculation: taxable amount = net accommodation + cleaning fee
  const taxableAmount = netAccommodationTotal.plus(cleaningFee).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const taxRatePercentDec = new Prisma.Decimal(req.taxRatePercent ?? 0);
  const taxAmount = taxableAmount.times(taxRatePercentDec).dividedBy(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const grandTotal = taxableAmount.plus(taxAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return {
    nightsCount,
    nightlyBreakdown,
    nightlySubtotal: nightlySubtotal.toFixed(2),
    extraGuestFees: extraGuestFees.toFixed(2),
    accommodationSubtotal: accommodationSubtotal.toFixed(2),
    discountCode: req.discount?.code,
    discountAmount: discountAmount.toFixed(2),
    netAccommodationTotal: netAccommodationTotal.toFixed(2),
    cleaningFee: cleaningFee.toFixed(2),
    taxableAmount: taxableAmount.toFixed(2),
    taxRatePercent: taxRatePercentDec.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    decimalBreakdown: {
      nightlySubtotal,
      extraGuestFees,
      accommodationSubtotal,
      discountAmount,
      netAccommodationTotal,
      cleaningFee,
      taxableAmount,
      taxAmount,
      grandTotal,
    },
  };
}
