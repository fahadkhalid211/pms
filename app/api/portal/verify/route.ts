import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAndGetBooking } from "@/lib/portal";

const verifySchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  bookingCode: z.string().min(1, "Booking reference is required"),
  email: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid verification request." } },
        { status: 400 },
      );
    }

    const reservation = await verifyAndGetBooking({
      organizationId: parsed.data.organizationId,
      bookingCode: parsed.data.bookingCode,
      email: parsed.data.email,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: reservation.id,
        code: reservation.code,
        status: reservation.status,
        propertyName: reservation.property.name,
        propertyAddress: `${reservation.property.addressLine1 || ""}, ${reservation.property.city || ""}`,
        checkIn: reservation.checkIn.toISOString().split("T")[0],
        checkOut: reservation.checkOut.toISOString().split("T")[0],
        checkInTime: reservation.property.checkInTime,
        checkOutTime: reservation.property.checkOutTime,
        adults: reservation.adults,
        children: reservation.children,
        totalAmount: reservation.totalAmount.toString(),
        currency: reservation.currency,
        guest: {
          firstName: reservation.guest?.firstName,
          lastName: reservation.guest?.lastName,
          email: reservation.guest?.email,
          phone: reservation.guest?.phone,
        },
        rooms: reservation.rooms.map((r) => ({
          roomId: r.roomId,
          number: r.room.number,
          roomType: r.room.roomType?.name,
        })),
        requests: reservation.requests.map((req) => ({
          id: req.id,
          type: req.type,
          content: req.content,
          status: req.status,
          createdAt: req.createdAt,
        })),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: { message: err.message ?? "Identity verification failed." } },
      { status: 403 },
    );
  }
}
