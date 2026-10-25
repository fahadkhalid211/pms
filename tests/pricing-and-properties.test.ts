import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { calculateStayPrice } from "@/lib/pricing/engine";
import { dal, CrossTenantViolationError, NotFoundError } from "@/lib/dal";

describe("WP3 Gate: Properties, Rooms, Room Types, Rate Plans, and Decimal Pricing Engine", () => {
  describe("1. Pricing Engine Unit Tests (Strict Decimal & Half-Up Rounding)", () => {
    it("computes simple single-night stay with exact tax rounding", () => {
      // 1 night @ $150.00, Tax = 10.25%, Cleaning = $40.00
      // Accommodation = $150.00
      // Cleaning = $40.00
      // Taxable = $190.00
      // Tax = 190.00 * 0.1025 = 19.475 -> rounds half-up to $19.48
      // Total = 190.00 + 19.48 = $209.48
      const quote = calculateStayPrice({
        checkIn: "2026-07-01",
        checkOut: "2026-07-02",
        baseRate: 150.0,
        taxRatePercent: 10.25,
        cleaningFee: 40.0,
      });

      expect(quote.nightsCount).toBe(1);
      expect(quote.nightlySubtotal).toBe("150.00");
      expect(quote.cleaningFee).toBe("40.00");
      expect(quote.taxableAmount).toBe("190.00");
      expect(quote.taxAmount).toBe("19.48");
      expect(quote.grandTotal).toBe("209.48");
    });

    it("computes multi-night stay crossing seasonal boundaries", () => {
      // Stay from 2026-06-29 to 2026-07-03 (4 nights: June 29, June 30, July 1, July 2)
      // Regular rate plan = $120.00
      // Seasonal rate starting 2026-07-01 to 2026-07-15 = $180.00
      // Nights 1 & 2 (June 29, 30) = 2 * $120.00 = $240.00
      // Nights 3 & 4 (July 1, 2) = 2 * $180.00 = $360.00
      // Nightly Subtotal = $600.00
      const quote = calculateStayPrice({
        checkIn: "2026-06-29",
        checkOut: "2026-07-03",
        baseRate: 100.0,
        ratePlan: {
          name: "Standard Rate",
          amount: 120.0,
          seasons: [
            {
              startDate: "2026-07-01",
              endDate: "2026-07-15",
              amount: 180.0,
              name: "July Peak Summer",
            },
          ],
        },
        taxRatePercent: 10.0,
        cleaningFee: 50.0,
      });

      expect(quote.nightsCount).toBe(4);
      expect(quote.nightlySubtotal).toBe("600.00");
      expect(quote.nightlyBreakdown).toHaveLength(4);
      expect(quote.nightlyBreakdown[0].rateApplied).toBe("120.00");
      expect(quote.nightlyBreakdown[1].rateApplied).toBe("120.00");
      expect(quote.nightlyBreakdown[2].rateApplied).toBe("180.00");
      expect(quote.nightlyBreakdown[3].rateApplied).toBe("180.00");

      // Taxable = 600.00 + 50.00 = 650.00
      // Tax = 650.00 * 0.10 = 65.00
      // Grand Total = 715.00
      expect(quote.taxableAmount).toBe("650.00");
      expect(quote.taxAmount).toBe("65.00");
      expect(quote.grandTotal).toBe("715.00");
    });

    it("applies percentage discount and rounds half-up correctly", () => {
      // 3 nights @ $133.33 = $399.99
      // 15% discount: 399.99 * 0.15 = 59.9985 -> rounds half-up to $60.00
      // Net accommodation = 399.99 - 60.00 = $339.99
      // Cleaning fee = $30.00
      // Taxable = 339.99 + 30.00 = $369.99
      // Tax @ 8.25%: 369.99 * 0.0825 = 30.524175 -> $30.52
      // Grand Total = 369.99 + 30.52 = $400.51
      const quote = calculateStayPrice({
        checkIn: "2026-08-10",
        checkOut: "2026-08-13",
        baseRate: 133.33,
        discount: {
          code: "SUMMER15",
          type: "percent",
          value: 15,
        },
        taxRatePercent: 8.25,
        cleaningFee: 30.0,
      });

      expect(quote.nightlySubtotal).toBe("399.99");
      expect(quote.discountAmount).toBe("60.00");
      expect(quote.netAccommodationTotal).toBe("339.99");
      expect(quote.taxAmount).toBe("30.52");
      expect(quote.grandTotal).toBe("400.51");
    });

    it("applies fixed discount capped at accommodation subtotal without negative totals", () => {
      // 2 nights @ $100.00 = $200.00
      // Coupon value = $500.00 (exceeds subtotal)
      // Discount amount should be capped at $200.00, resulting in $0.00 net accommodation
      const quote = calculateStayPrice({
        checkIn: "2026-09-01",
        checkOut: "2026-09-03",
        baseRate: 100.0,
        discount: {
          code: "BIGCREDIT",
          type: "fixed",
          value: 500.0,
        },
        cleaningFee: 25.0,
        taxRatePercent: 10.0,
      });

      expect(quote.nightlySubtotal).toBe("200.00");
      expect(quote.discountAmount).toBe("200.00");
      expect(quote.netAccommodationTotal).toBe("0.00");
      expect(quote.taxableAmount).toBe("25.00"); // only cleaning fee remains
      expect(quote.taxAmount).toBe("2.50");
      expect(quote.grandTotal).toBe("27.50");
    });

    it("calculates extra guest surcharge for guests exceeding capacity", () => {
      // 2 nights @ $150 = $300.00
      // Room capacity = 2, Adults = 4 (2 extra guests)
      // Extra fee = $25.00 per extra guest per night
      // Extra fees = 2 extra * $25.00 * 2 nights = $100.00
      // Total accommodation = $300 + $100 = $400.00
      const quote = calculateStayPrice({
        checkIn: "2026-10-01",
        checkOut: "2026-10-03",
        baseRate: 150.0,
        adults: 4,
        capacity: 2,
        extraGuestFeePerNight: 25.0,
      });

      expect(quote.extraGuestFees).toBe("100.00");
      expect(quote.accommodationSubtotal).toBe("400.00");
      expect(quote.grandTotal).toBe("400.00");
    });

    it("rejects invalid dates and zero-night stays", () => {
      expect(() => {
        calculateStayPrice({
          checkIn: "2026-05-10",
          checkOut: "2026-05-10",
          baseRate: 100,
        });
      }).toThrow(/Check-out date must be strictly after check-in date/);

      expect(() => {
        calculateStayPrice({
          checkIn: "2026-05-12",
          checkOut: "2026-05-10",
          baseRate: 100,
        });
      }).toThrow(/Check-out date must be strictly after check-in date/);

      expect(() => {
        calculateStayPrice({
          checkIn: "invalid-date",
          checkOut: "2026-05-10",
          baseRate: 100,
        });
      }).toThrow(/Invalid check-in or check-out date/);
    });

    it("accurately handles leap-year and month boundary stays", () => {
      // 2028 is a leap year (Feb 29 exists)
      // Feb 28 to Mar 1 = 2 nights (Feb 28, Feb 29)
      const quote = calculateStayPrice({
        checkIn: "2028-02-28",
        checkOut: "2028-03-01",
        baseRate: 200,
      });

      expect(quote.nightsCount).toBe(2);
      expect(quote.nightlyBreakdown[0].date).toBe("2028-02-28");
      expect(quote.nightlyBreakdown[1].date).toBe("2028-02-29");
      expect(quote.grandTotal).toBe("400.00");
    });
  });

  describe("2. Room Type CRUD and Tenant Isolation via DAL", () => {
    it("creates, queries, and updates room types scoped to organization", async () => {
      const timestamp = Date.now().toString(36);
      const org = await prisma.organization.create({
        data: { name: `RT Org ${timestamp}`, slug: `rt-org-${timestamp}` },
      });
      const ctx = { organizationId: org.id };

      const prop = await dal.properties.create(ctx, {
        name: "Alpine Resort",
        code: "ALP",
        currency: "USD",
        taxRate: 12.0,
      });

      // Create room type
      const rt = await dal.roomTypes.create(ctx, {
        propertyId: prop.id,
        name: "Mountain Vista King",
        capacity: 2,
        bedType: "1 King Bed",
        baseRate: "249.50",
      });

      expect(rt.id).toBeDefined();
      expect(rt.name).toBe("Mountain Vista King");
      expect(new Prisma.Decimal(rt.baseRate).toFixed(2)).toBe("249.50");

      // List room types
      const list = await dal.roomTypes.findMany(ctx, prop.id);
      expect(list.some((item) => item.id === rt.id)).toBe(true);

      // Update room type
      const updated = await dal.roomTypes.update(ctx, rt.id, {
        baseRate: "275.00",
        capacity: 3,
      });
      expect(new Prisma.Decimal(updated.baseRate).toFixed(2)).toBe("275.00");
      expect(updated.capacity).toBe(3);

      // Rejects cross-tenant parent property ID
      const otherOrg = await prisma.organization.create({
        data: { name: `Foreign Org ${timestamp}`, slug: `foreign-${timestamp}` },
      });
      const otherCtx = { organizationId: otherOrg.id };

      let crossDenied = false;
      try {
        await dal.roomTypes.create(otherCtx, {
          propertyId: prop.id, // belongs to org, not otherOrg!
          name: "Hacker Suite",
          baseRate: "99.00",
        });
      } catch (err: any) {
        crossDenied = true;
        expect(err).toBeInstanceOf(CrossTenantViolationError);
      }
      expect(crossDenied).toBe(true);
    });

    it("prevents deleting room types with active rooms assigned", async () => {
      const timestamp = Date.now().toString(36);
      const org = await prisma.organization.create({
        data: { name: `Delete Guard Org ${timestamp}`, slug: `del-org-${timestamp}` },
      });
      const ctx = { organizationId: org.id };

      const prop = await dal.properties.create(ctx, { name: "City Hotel", code: "CTY" });
      const rt = await dal.roomTypes.create(ctx, {
        propertyId: prop.id,
        name: "Standard Queen",
        baseRate: "150.00",
      });

      // Create room linked to room type
      await dal.rooms.create(ctx, {
        propertyId: prop.id,
        roomTypeId: rt.id,
        number: "401",
      });

      // Deleting room type should fail
      let failed = false;
      try {
        await dal.roomTypes.delete(ctx, rt.id);
      } catch (err: any) {
        failed = true;
        expect(err.message).toMatch(/Cannot delete room type/);
      }
      expect(failed).toBe(true);
    });
  });

  describe("3. Rate Plans & Seasonal Adjustments via DAL", () => {
    it("manages rate plans and nested seasonal rate windows", async () => {
      const timestamp = Date.now().toString(36);
      const org = await prisma.organization.create({
        data: { name: `RatePlan Org ${timestamp}`, slug: `rp-org-${timestamp}` },
      });
      const ctx = { organizationId: org.id };

      const prop = await dal.properties.create(ctx, { name: "Oceanfront Inn", code: "OFI" });

      // Create rate plan
      const plan = await dal.ratePlans.create(ctx, {
        propertyId: prop.id,
        name: "Flexible Daily Rate",
        amount: "180.00",
        type: "fixed",
      });

      expect(plan.id).toBeDefined();
      expect(new Prisma.Decimal(plan.amount).toFixed(2)).toBe("180.00");

      // Add seasonal rate window
      const season = await dal.seasonalRates.create(ctx, {
        ratePlanId: plan.id,
        startDate: "2026-12-20",
        endDate: "2027-01-05",
        amount: "290.00",
      });

      expect(season.id).toBeDefined();
      expect(new Prisma.Decimal(season.amount).toFixed(2)).toBe("290.00");

      // Fetch plan with seasons
      const fetched = await dal.ratePlans.findUnique(ctx, plan.id);
      expect(fetched.seasons).toHaveLength(1);
      expect(fetched.seasons[0].id).toBe(season.id);

      // Delete season
      await dal.seasonalRates.delete(ctx, season.id);
      const afterDelete = await dal.ratePlans.findUnique(ctx, plan.id);
      expect(afterDelete.seasons).toHaveLength(0);
    });
  });

  describe("4. Discounts & Coupons via DAL", () => {
    it("creates and looks up discount codes respecting expiration dates", async () => {
      const timestamp = Date.now().toString(36);
      const org = await prisma.organization.create({
        data: { name: `Discount Org ${timestamp}`, slug: `disc-org-${timestamp}` },
      });
      const ctx = { organizationId: org.id };

      // Valid coupon
      await dal.discounts.create(ctx, {
        code: "WELCOME20",
        type: "percent",
        value: "20.00",
        validFrom: new Date(Date.now() - 86400000), // yesterday
        validTo: new Date(Date.now() + 86400000 * 30), // in 30 days
      });

      // Expired coupon
      await dal.discounts.create(ctx, {
        code: "EXPIRED50",
        type: "percent",
        value: "50.00",
        validFrom: new Date(Date.now() - 86400000 * 10),
        validTo: new Date(Date.now() - 86400000), // ended yesterday
      });

      const foundValid = await dal.discounts.findByCode(ctx, "WELCOME20");
      expect(foundValid).not.toBeNull();
      expect(foundValid?.code).toBe("WELCOME20");

      const foundExpired = await dal.discounts.findByCode(ctx, "EXPIRED50");
      expect(foundExpired).toBeNull();
    });
  });

  describe("5. Atomic Setup Wizard Onboarding", () => {
    it("provisions an entire property, room types, rooms, and rate plans in a single transaction", async () => {
      const timestamp = Date.now().toString(36);
      const org = await prisma.organization.create({
        data: { name: `Wizard Org ${timestamp}`, slug: `wiz-org-${timestamp}` },
      });
      const ctx = { organizationId: org.id };

      const setupResult = await dal.onboarding.setupProperty(ctx, {
        property: {
          name: "Lumina Sunset Villas",
          code: "LSV",
          city: "Maui",
          country: "United States",
          currency: "USD",
          timezone: "Pacific/Honolulu",
          checkInTime: 16,
          checkOutTime: 10,
          taxRate: "13.50",
          cleaningFee: "65.00",
        },
        roomTypes: [
          { name: "Ocean Villa", capacity: 4, bedType: "2 King Beds", baseRate: "450.00" },
          { name: "Garden Cottage", capacity: 2, bedType: "1 Queen Bed", baseRate: "280.00" },
        ],
        rooms: [
          { number: "V1", floor: "1", roomTypeName: "Ocean Villa" },
          { number: "V2", floor: "1", roomTypeName: "Ocean Villa" },
          { number: "C1", floor: "1", roomTypeName: "Garden Cottage" },
          { number: "C2", floor: "1", roomTypeName: "Garden Cottage" },
        ],
        ratePlans: [
          { name: "Villa Standard Rate", amount: "450.00", type: "fixed" },
          { name: "Non-Refundable 10% Off", amount: "405.00", type: "fixed" },
        ],
      });

      expect(setupResult.property.id).toBeDefined();
      expect(setupResult.property.code).toBe("LSV");
      expect(setupResult.roomTypes).toHaveLength(2);
      expect(setupResult.rooms).toHaveLength(4);
      expect(setupResult.ratePlans).toHaveLength(2);

      // Verify records in DB
      const dbRooms = await dal.rooms.findMany(ctx, setupResult.property.id);
      expect(dbRooms).toHaveLength(4);
      expect(dbRooms.map((r) => r.number).sort()).toEqual(["C1", "C2", "V1", "V2"]);

      // Verify Pricing Quote against the newly onboarded property
      const oceanVilla = setupResult.roomTypes.find((rt) => rt.name === "Ocean Villa")!;
      const quote = calculateStayPrice({
        checkIn: "2026-11-01",
        checkOut: "2026-11-05", // 4 nights @ $450 = $1800
        baseRate: 450.0,
        taxRatePercent: setupResult.property.taxRate, // 13.5%
        cleaningFee: setupResult.property.cleaningFee, // $65.00
      });

      // 4 * 450 = 1800
      // Taxable = 1800 + 65 = 1865
      // Tax = 1865 * 0.135 = 251.775 -> $251.78
      // Total = 1865 + 251.78 = $2116.78
      expect(quote.nightsCount).toBe(4);
      expect(quote.nightlySubtotal).toBe("1800.00");
      expect(quote.taxableAmount).toBe("1865.00");
      expect(quote.taxAmount).toBe("251.78");
      expect(quote.grandTotal).toBe("2116.78");
    });
  });
});
