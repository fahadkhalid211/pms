import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/passwords";

export async function GET() {
  try {
    const user = await requirePermission("staff.manage");
    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: user.organizationId ?? "" },
      include: { user: { select: { id: true, email: true, name: true, status: true, roleKey: true } }, role: true },
      orderBy: { user: { email: "asc" } },
    });
    return NextResponse.json({ success: true, data: members });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load staff" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("staff.manage");
    const body = await request.json();
    const passwordHash = await hashPassword(body.password);
    const staffUser = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
        roleKey: body.roleKey,
        organizationId: user.organizationId ?? undefined,
        status: "active",
        propertyIds: [],
      },
    });
    const membership = await prisma.organizationMembership.create({
      data: {
        organizationId: user.organizationId ?? "",
        userId: staffUser.id,
        roleKey: body.roleKey,
        status: "active",
        propertyIds: body.propertyIds ?? [],
      },
      include: { role: true },
    });
    return NextResponse.json({ success: true, data: membership }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create staff member" } }, { status: 400 });
  }
}
