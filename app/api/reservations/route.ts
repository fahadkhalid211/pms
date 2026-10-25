import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { listReservations, createReservation } from "@/lib/reservations";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("reservations.view");
    const url = new URL(request.url);
    const result = await listReservations({
      organizationId: user.organizationId ?? "",
      propertyId: url.searchParams.get("propertyId"),
      status: url.searchParams.get("status") ?? undefined,
      query: url.searchParams.get("query") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
      pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error?.status === 403) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    }
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load reservations" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("reservations.create");
    const body = await request.json();
    const reservation = await createReservation({
      organizationId: user.organizationId ?? "",
      propertyId: body.propertyId,
      roomIds: body.roomIds ?? [],
      checkIn: new Date(body.checkIn),
      checkOut: new Date(body.checkOut),
      adults: body.adults ?? 1,
      children: body.children ?? 0,
      guestId: body.guestId ?? null,
      source: body.source ?? "direct",
      notes: body.notes,
      status: body.status ?? "confirmed",
    });
    return NextResponse.json({ success: true, data: reservation }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    }
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create reservation" } }, { status: 400 });
  }
}
