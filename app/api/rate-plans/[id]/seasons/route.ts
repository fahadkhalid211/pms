import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const CreateSeasonSchema = z.object({
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  amount: z.union([z.string(), z.number()]).refine((val) => Number(val) >= 0, "amount must be non-negative"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("rates.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = CreateSeasonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const season = await dal.seasonalRates.create(
      { organizationId: user.organizationId },
      {
        ratePlanId: id,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        amount: parsed.data.amount,
      },
    );

    return NextResponse.json({ success: true, data: season }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create seasonal rate" } }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params; // consume params
    const user = await requirePermission("rates.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");
    if (!seasonId) {
      return NextResponse.json({ success: false, error: { message: "seasonId query parameter is required" } }, { status: 400 });
    }

    await dal.seasonalRates.delete({ organizationId: user.organizationId }, seasonId);
    return NextResponse.json({ success: true, message: "Seasonal rate deleted successfully" });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to delete seasonal rate" } }, { status });
  }
}
