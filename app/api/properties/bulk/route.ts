import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/audit";

const bulkPropertyItemSchema = z.object({
  name: z.string().trim().min(1, "Property name is required"),
  code: z.string().trim().max(16).optional(),
  addressLine1: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  postalCode: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  timezone: z.string().trim().optional().default("UTC"),
  currency: z.string().trim().max(3).optional().default("USD"),
  checkInTime: z.coerce.number().int().min(0).max(23).optional().default(15),
  checkOutTime: z.coerce.number().int().min(0).max(23).optional().default(11),
  taxRate: z.coerce.number().min(0).optional().default(0),
  cleaningFee: z.coerce.number().min(0).optional().default(0),
  description: z.string().optional().nullable(),
  roomsCount: z.coerce.number().int().min(0).max(100).optional().default(1),
  roomTypeName: z.string().trim().optional().default("Standard Unit"),
  baseRate: z.coerce.number().min(0).optional().default(150),
});

const bulkPropertiesPayloadSchema = z.object({
  properties: z.array(bulkPropertyItemSchema).min(1, "At least one property is required").max(200),
});

function buildPropertyCode(name: string, index: number): string {
  const letters = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
  return `${letters || "PROP"}${String(index + 1).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("properties.manage", { request });
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = bulkPropertiesPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid bulk property payload" } },
        { status: 400 },
      );
    }

    const existingProperties = await prisma.property.findMany({
      where: { organizationId },
      select: { id: true, name: true, code: true },
    });
    const existingNames = new Set(existingProperties.map((p) => p.name.toLowerCase()));
    const existingCodes = new Set(existingProperties.map((p) => p.code.toUpperCase()));

    const created: Array<{ id: string; name: string; code: string; roomsCreated: number }> = [];
    const skipped: Array<{ name: string; reason: string }> = [];

    for (let i = 0; i < parsed.data.properties.length; i += 1) {
      const item = parsed.data.properties[i];
      if (existingNames.has(item.name.toLowerCase())) {
        skipped.push({ name: item.name, reason: "Property with this name already exists" });
        continue;
      }

      let code = (item.code || buildPropertyCode(item.name, existingProperties.length + i)).toUpperCase().slice(0, 16);
      if (existingCodes.has(code)) {
        code = `${code.slice(0, 12)}-${(i + 1).toString(36).toUpperCase()}`;
      }

      const result = await prisma.$transaction(async (tx) => {
        const property = await tx.property.create({
          data: {
            organizationId,
            name: item.name,
            code,
            addressLine1: item.addressLine1 || null,
            city: item.city || null,
            state: item.state || null,
            postalCode: item.postalCode || null,
            country: item.country || null,
            phone: item.phone || null,
            email: item.email === "" ? null : (item.email || null),
            timezone: item.timezone || "UTC",
            currency: (item.currency || "USD").toUpperCase(),
            checkInTime: item.checkInTime,
            checkOutTime: item.checkOutTime,
            taxRate: new Prisma.Decimal(item.taxRate),
            cleaningFee: new Prisma.Decimal(item.cleaningFee),
            description: item.description || null,
            status: "active",
          },
        });

        let roomsCreated = 0;
        if (item.roomsCount > 0) {
          const roomType = await tx.roomType.create({
            data: {
              organizationId,
              propertyId: property.id,
              name: item.roomTypeName || "Standard Unit",
              capacity: 2,
              baseRate: new Prisma.Decimal(item.baseRate),
            },
          });

          for (let rIdx = 0; rIdx < item.roomsCount; rIdx += 1) {
            const roomNumber = item.roomsCount === 1 ? "MAIN" : String(101 + rIdx);
            await tx.room.create({
              data: {
                organizationId,
                propertyId: property.id,
                roomTypeId: roomType.id,
                number: roomNumber,
                name: `${item.name} ${roomNumber}`,
                status: "available",
              },
            });
            roomsCreated += 1;
          }
        }

        return { property, roomsCreated };
      });

      existingNames.add(result.property.name.toLowerCase());
      existingCodes.add(result.property.code.toUpperCase());
      created.push({
        id: result.property.id,
        name: result.property.name,
        code: result.property.code,
        roomsCreated: result.roomsCreated,
      });
    }

    await logActivity({
      organizationId,
      userId: user.id,
      source: "backend",
      category: "operations",
      action: "property.bulk_imported",
      summary: `Bulk imported ${created.length} properties (${skipped.length} skipped).`,
      metadata: { importedCount: created.length, skippedCount: skipped.length },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          imported: created.length,
          skippedCount: skipped.length,
          created,
          skipped,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Bulk property import failed" } }, { status: 400 });
  }
}
