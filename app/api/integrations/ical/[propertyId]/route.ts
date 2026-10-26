import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generatePropertyIcalFeed } from "@/lib/integrations";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  try {
    const { propertyId } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    // Lookup property
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        ...(orgId ? { organizationId: orgId } : {}),
      },
      select: { id: true, organizationId: true, name: true },
    });

    if (!property) {
      return new Response("Property calendar not found", { status: 404 });
    }

    const icsContent = await generatePropertyIcalFeed(property.organizationId, property.id);

    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${property.name.toLowerCase().replace(/\s+/g, "-")}-calendar.ics"`,
        "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    return new Response(`Error generating iCal feed: ${err.message}`, { status: 500 });
  }
}
