import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const CreateReservationSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  roomIds: z.array(z.string().min(1)).min(1, "At least one roomId is required"),
  checkIn: z.string().min(1, "checkIn date is required"),
  checkOut: z.string().min(1, "checkOut date is required"),
  adults: z.coerce.number().int().min(1).optional().default(1),
  children: z.coerce.number().int().min(0).optional().default(0),
  guestId: z.string().optional().nullable(),
  guest: z
    .object({
      firstName: z.string().min(1, "Guest first name is required"),
      lastName: z.string().min(1, "Guest last name is required"),
      email: z.string().email().optional().nullable().or(z.literal("")),
      phone: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  source: z.enum(["direct", "public_portal", "agent", "phone", "walk_in", "ota"]).optional().default("direct"),
  notes: z.string().optional().nullable(),
  status: z.enum(["draft", "pending", "confirmed", "checked_in"]).optional().default("confirmed"),
  ratePlanId: z.string().optional().nullable(),
  discountCode: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("reservations.view", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const result = await dal.reservations.findMany(
      { organizationId: user.organizationId },
      {
        propertyId: searchParams.get("propertyId") || undefined,
        status: searchParams.get("status") || undefined,
        search: searchParams.get("query") || undefined,
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
        page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined,
        pageSize: searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : undefined,
      },
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load reservations" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("reservations.create", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    // Check Idempotency Key
    const idempotencyKey = request.headers.get("idempotency-key") || request.headers.get("x-idempotency-key");
    if (idempotencyKey) {
      const cached = await prisma.idempotencyKey.findUnique({
        where: {
          organizationId_key: {
            organizationId: user.organizationId,
            key: idempotencyKey,
          },
        },
      });

      if (cached && cached.expiresAt > new Date() && cached.responseBody) {
        return NextResponse.json(cached.responseBody, { status: cached.statusCode ?? 200 });
      }
    }

    const body = await request.json();
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const created = await dal.reservations.create(
      { organizationId: user.organizationId },
      {
        propertyId: parsed.data.propertyId,
        roomIds: parsed.data.roomIds,
        checkIn: parsed.data.checkIn,
        checkOut: parsed.data.checkOut,
        adults: parsed.data.adults,
        children: parsed.data.children,
        guestId: parsed.data.guestId,
        guest: parsed.data.guest,
        source: parsed.data.source,
        notes: parsed.data.notes,
        status: parsed.data.status,
        ratePlanId: parsed.data.ratePlanId,
        discountCode: parsed.data.discountCode,
      },
    );

    const responsePayload = {
      success: true,
      data: {
        ...created,
        reservation: created.reservation,
      },
    };

    // Store in IdempotencyKey if header was provided
    if (idempotencyKey) {
      await prisma.idempotencyKey.upsert({
        where: {
          organizationId_key: {
            organizationId: user.organizationId,
            key: idempotencyKey,
          },
        },
        update: {
          statusCode: 201,
          responseBody: JSON.parse(JSON.stringify(responsePayload)),
          expiresAt: new Date(Date.now() + 86400000),
          route: "/api/reservations",
        },
        create: {
          organizationId: user.organizationId,
          key: idempotencyKey,
          route: "/api/reservations",
          statusCode: 201,
          responseBody: JSON.parse(JSON.stringify(responsePayload)),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
    }

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create reservation" } }, { status });
  }
}
