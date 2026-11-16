import * as XLSX from "xlsx";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS } from "../lib/permissions.ts";

const prisma = new PrismaClient();

const buf = fs.readFileSync("client-data.xlsx");
const wb = XLSX.read(buf, { type: "buffer", cellDates: true, cellNF: true, cellText: true });
const ws = wb.Sheets["Booking Report"];

function parseDateStr(str) {
  if (!str) return null;
  str = String(str).trim();
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const [, d, m, y] = m1;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 14, 0, 0));
  }
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const [, y, m, d] = m2;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 14, 0, 0));
  }
  return null;
}

function resolveDates(checkInCell, checkOutCell, nights) {
  const inText = checkInCell?.w || checkInCell?.v;
  const outText = checkOutCell?.w || checkOutCell?.v;

  let dIn = checkInCell?.t === "d" ? new Date(checkInCell.v.getTime() + checkInCell.v.getTimezoneOffset() * 60000) : parseDateStr(inText);
  let dOut = checkOutCell?.t === "d" ? new Date(checkOutCell.v.getTime() + checkOutCell.v.getTimezoneOffset() * 60000) : parseDateStr(outText);

  if (checkInCell?.t === "d") {
    const origD = checkInCell.v.getUTCDate();
    const origM = checkInCell.v.getUTCMonth();
    const origY = checkInCell.v.getUTCFullYear();
    const swapped = new Date(Date.UTC(origY, origD - 1, origM + 1, 14, 0, 0));
    if (dOut) {
      const diff1 = Math.round((dOut.getTime() - dIn.getTime()) / 86400000);
      const diff2 = Math.round((dOut.getTime() - swapped.getTime()) / 86400000);
      if (diff1 === nights) {
        // match
      } else if (diff2 === nights) {
        dIn = swapped;
      } else {
        dIn = new Date(dOut.getTime() - nights * 86400000);
      }
    }
  }

  if (checkOutCell?.t === "d" && dIn) {
    const diff1 = Math.round((dOut.getTime() - dIn.getTime()) / 86400000);
    if (diff1 !== nights) {
      const origD = checkOutCell.v.getUTCDate();
      const origM = checkOutCell.v.getUTCMonth();
      const origY = checkOutCell.v.getUTCFullYear();
      const swapped = new Date(Date.UTC(origY, origD - 1, origM + 1, 10, 0, 0));
      const diff2 = Math.round((swapped.getTime() - dIn.getTime()) / 86400000);
      if (diff2 === nights) {
        dOut = swapped;
      } else {
        dOut = new Date(dIn.getTime() + nights * 86400000);
      }
    }
  }

  if (dIn && !dOut && nights) dOut = new Date(dIn.getTime() + nights * 86400000);
  if (!dIn && dOut && nights) dIn = new Date(dOut.getTime() - nights * 86400000);

  if (dIn) dIn.setUTCHours(15, 0, 0, 0);
  if (dOut) dOut.setUTCHours(11, 0, 0, 0);

  return { dIn, dOut };
}

function parseGuest(guestRaw) {
  let name = String(guestRaw || "").trim();
  let adults = 1;
  const m = name.match(/^(.*?)\s*\((\d+)\s*adults?\)$/i);
  if (m) {
    name = m[1].trim();
    adults = parseInt(m[2], 10) || 1;
  }
  const parts = name.split(/\s+/);
  const firstName = parts[0] || "Valued";
  const lastName = parts.slice(1).join(" ") || "Guest";
  return { firstName, lastName, fullName: `${firstName} ${lastName}`, adults };
}

function parseSourceInfo(sourceRaw) {
  let channel = "direct";
  let rawSource = String(sourceRaw || "").trim();
  let createdDate = null;

  if (rawSource.toLowerCase().includes("airbnb")) {
    channel = "airbnb";
  } else if (rawSource.toLowerCase().includes("booking.com")) {
    channel = "booking_com";
  } else if (rawSource.toLowerCase().includes("hostfully")) {
    channel = "hostfully";
  }

  const m = rawSource.match(/Created on (\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (m) {
    const [, d, mo, y] = m;
    createdDate = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12, 0, 0));
  }

  return { channel, rawSource, createdDate };
}

async function run() {
  console.log("=== STARTING THE PENTHOUSE LIVING RE-IMPORT ===");

  const org = await prisma.organization.findFirst({
    where: { slug: "the-penthouse-living" },
  });

  if (!org) {
    throw new Error("Organization the-penthouse-living not found!");
  }

  // 1. Clean previous reservations, roomNights, invoices, payments, rooms to do a clean re-import
  console.log("Cleaning previous operational records for clean alignment...");
  await prisma.payment.deleteMany({ where: { organizationId: org.id } });
  await prisma.invoiceLineItem.deleteMany({ where: { organizationId: org.id } });
  await prisma.invoice.deleteMany({ where: { organizationId: org.id } });
  await prisma.roomNight.deleteMany({ where: { organizationId: org.id } });
  await prisma.reservationRoom.deleteMany({ where: { organizationId: org.id } });
  await prisma.reservation.deleteMany({ where: { organizationId: org.id } });
  await prisma.roomAmenity.deleteMany({ where: { organizationId: org.id } });
  await prisma.room.deleteMany({ where: { organizationId: org.id } });
  await prisma.roomType.deleteMany({ where: { organizationId: org.id } });

  // 2. Setup Properties & Units
  console.log("Configuring properties and room inventory...");
  const propertySpecs = [
    {
      name: "LP4609 1-Bed",
      code: "LP4609",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 2,
      baseRate: 250,
      rooms: [
        { number: "LP4609-1", name: "1-Bed Executive Apartment (Unit 1)" },
        { number: "LP4609-2", name: "1-Bed Executive Apartment (Unit 2)" },
      ],
    },
    {
      name: "WD 3206 2 Bedrooms",
      code: "WD3206-2B",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 4,
      baseRate: 500,
      rooms: [{ number: "WD3206-2B", name: "2-Bedroom Premier Residence" }],
    },
    {
      name: "WD3206 2 Bedrooms double list",
      code: "WD3206-DL",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 4,
      baseRate: 500,
      rooms: [{ number: "WD3206-DL", name: "2-Bedroom Luxury Suite (B)" }],
    },
    {
      name: "WD3206 Ensuite in 2Bdrm",
      code: "WD3206-ENS",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 2,
      baseRate: 300,
      rooms: [{ number: "WD3206-ENS", name: "Ensuite Room in 2-Bed" }],
    },
    {
      name: "WD3206 Suite in 2Bedrm",
      code: "WD3206-STE",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 2,
      baseRate: 300,
      rooms: [{ number: "WD3206-STE", name: "Master Suite in 2-Bed" }],
    },
    {
      name: "WD4308 Studio Balcony",
      code: "WD4308",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 2,
      baseRate: 280,
      rooms: [
        { number: "WD4308-1", name: "Studio with Balcony (Unit 1)" },
        { number: "WD4308-2", name: "Studio with Balcony (Unit 2)" },
      ],
    },
    {
      name: "LP6502 3-bed",
      code: "LP6502-3B",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 10,
      baseRate: 900,
      rooms: [{ number: "LP6502-3B", name: "3-Bedroom Penthouse" }],
    },
    {
      name: "LP6502 King bedroom in 3Bedrm",
      code: "LP6502-KNG",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 2,
      baseRate: 350,
      rooms: [{ number: "LP6502-KNG", name: "King Bedroom in Penthouse" }],
    },
    {
      name: "LP6502 Enuite California-Kingbeds",
      code: "LP6502-CK",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 2,
      baseRate: 400,
      rooms: [{ number: "LP6502-CK", name: "Cal-King Ensuite in Penthouse" }],
    },
    {
      name: "LP6502 S-kingTwin Bed in 3Bedrm",
      code: "LP6502-SK",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 2,
      baseRate: 350,
      rooms: [{ number: "LP6502-SK", name: "Super-King/Twin Room in Penthouse" }],
    },
    {
      name: "Kensington Residence Parent",
      code: "KENS-PAR",
      currency: "GBP",
      city: "London",
      country: "United Kingdom",
      tz: "Europe/London",
      capacity: 6,
      baseRate: 650,
      rooms: [{ number: "KENS-PAR", name: "Kensington Residence Master Property" }],
    },
    {
      name: "Cozy Studio 1-3P Eiffel Tower n Quai de Seine",
      code: "EIFFEL-STD",
      currency: "EUR",
      city: "Paris",
      country: "France",
      tz: "Europe/Paris",
      address: "1 Pass. Landrieu, Paris, France",
      capacity: 3,
      baseRate: 200,
      rooms: [{ number: "EIFFEL-STD", name: "Eiffel Tower Seine View Studio" }],
    },
  ];

  const propertyMap = new Map();

  for (const spec of propertySpecs) {
    let prop = await prisma.property.findFirst({
      where: { organizationId: org.id, name: spec.name },
    });

    if (!prop) {
      prop = await prisma.property.create({
        data: {
          organizationId: org.id,
          name: spec.name,
          code: spec.code,
          currency: spec.currency,
          city: spec.city,
          country: spec.country,
          timezone: spec.tz,
          addressLine1: spec.address || "Central London, UK",
          email: "Booking@ThePenthouseLiving.com",
          phone: "+447514406592",
          checkInTime: 15,
          checkOutTime: 11,
          status: "active",
          description: `Luxury serviced accommodation managed by The Penthouse Living in ${spec.city}.`,
        },
      });
    }

    // RoomType
    const roomType = await prisma.roomType.create({
      data: {
        organizationId: org.id,
        propertyId: prop.id,
        name: spec.name,
        capacity: spec.capacity,
        baseRate: spec.baseRate,
      },
    });

    // Rooms
    const createdRooms = [];
    for (const rSpec of spec.rooms) {
      const room = await prisma.room.create({
        data: {
          organizationId: org.id,
          propertyId: prop.id,
          roomTypeId: roomType.id,
          number: rSpec.number,
          name: rSpec.name,
          status: "available",
        },
      });
      createdRooms.push(room);
    }

    propertyMap.set(spec.name, { property: prop, roomType, rooms: createdRooms });
  }

  // 3. Track occupied dates per room in memory for fast, perfect collision-free allocation
  const roomOccupancy = new Map();
  for (const [, info] of propertyMap) {
    for (const r of info.rooms) {
      roomOccupancy.set(r.id, new Set());
    }
  }

  console.log("Importing 172 reservations with multi-unit scheduling...");
  let bookingsImported = 0;
  let roomNightsImported = 0;
  let invoicesImported = 0;
  let paymentsImported = 0;

  for (let r = 11; r <= 182; r++) {
    const propCell = ws[`A${r}`];
    if (!propCell || !propCell.v || String(propCell.v).startsWith("Total")) break;

    const propName = String(propCell.v).trim();
    const guestCell = ws[`B${r}`];
    const sourceCell = ws[`C${r}`];
    const resCodeCell = ws[`D${r}`];
    const inCell = ws[`E${r}`];
    const outCell = ws[`F${r}`];
    const extIdCell = ws[`G${r}`];
    const nights = Number(ws[`H${r}`]?.v || 0);
    const rent = Number(ws[`I${r}`]?.v || 0);
    const fees = Number(ws[`J${r}`]?.v || 0);
    const tax = Number(ws[`K${r}`]?.v || 0);
    const total = Number(ws[`L${r}`]?.v || 0);
    const guestPaid = Number(ws[`M${r}`]?.v || 0);
    const guestDue = Number(ws[`N${r}`]?.v || 0);
    const agencyDue = Number(ws[`O${r}`]?.v || 0);
    const ownerBalance = Number(ws[`P${r}`]?.v || 0);

    const propInfo = propertyMap.get(propName);
    if (!propInfo) {
      console.warn(`Row ${r}: Property '${propName}' not found in map!`);
      continue;
    }

    const { dIn, dOut } = resolveDates(inCell, outCell, nights);
    if (!dIn || !dOut) {
      console.warn(`Row ${r}: Could not resolve dates!`);
      continue;
    }

    const guestInfo = parseGuest(guestCell?.v);
    const sourceInfo = parseSourceInfo(String(sourceCell?.v || ""));

    // Upsert Guest
    const guestEmailSlug = guestInfo.fullName.toLowerCase().replace(/[^a-z0-9]/g, ".");
    const guestEmail = `${guestEmailSlug}@guest.thepenthouseliving.com`;

    let guest = await prisma.guest.findFirst({
      where: { organizationId: org.id, email: guestEmail },
    });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          organizationId: org.id,
          firstName: guestInfo.firstName,
          lastName: guestInfo.lastName,
          email: guestEmail,
          phone: "+447000000000",
          notes: `VIP Guest of The Penthouse Living. Primary channel: ${sourceInfo.channel}.`,
        },
      });
      await prisma.guestProfile.create({
        data: {
          organizationId: org.id,
          guestId: guest.id,
          preferences: {
            preferredChannel: sourceInfo.channel,
            adults: guestInfo.adults,
          },
        },
      });
    }

    // Reservation Code
    const rawCode = String(resCodeCell?.v || `RES-${r}`);
    const shortCode = `TPL-${rawCode.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}`;

    const now = new Date();
    let resStatus = "confirmed";
    if (dOut < now) resStatus = "checked_out";
    else if (dIn <= now && dOut >= now) resStatus = "checked_in";

    const externalId = String(extIdCell?.v || "").trim();
    const currency = propInfo.property.currency;

    const reservationSource = (sourceInfo.channel === "airbnb" || sourceInfo.channel === "booking_com") ? "ota" : "direct";

    const reservationNotes = [
      `Channel: ${sourceInfo.rawSource}`,
      externalId && externalId !== "-" ? `Ref: ${externalId}` : null,
      `Rent: ${currency} ${rent.toFixed(2)}`,
      fees > 0 ? `Fees: ${currency} ${fees.toFixed(2)}` : null,
      tax > 0 ? `Tax: ${currency} ${tax.toFixed(2)}` : null,
      `Guest Paid: ${currency} ${guestPaid.toFixed(2)}`,
      guestDue > 0 ? `Guest Balance Due: ${currency} ${guestDue.toFixed(2)}` : null,
      `Agency Commission: ${currency} ${agencyDue.toFixed(2)}`,
      `Owner Balance: ${currency} ${ownerBalance.toFixed(2)}`,
    ].filter(Boolean).join(" | ");

    const reservation = await prisma.reservation.create({
      data: {
        organizationId: org.id,
        propertyId: propInfo.property.id,
        guestId: guest.id,
        code: shortCode,
        status: resStatus,
        source: reservationSource,
        checkIn: dIn,
        checkOut: dOut,
        adults: guestInfo.adults,
        children: 0,
        totalAmount: total,
        currency,
        notes: reservationNotes,
        createdAt: sourceInfo.createdDate || dIn,
      },
    });

    // Find available room for this property without date collision
    let chosenRoom = null;
    for (const candRoom of propInfo.rooms) {
      const occSet = roomOccupancy.get(candRoom.id);
      let conflict = false;
      for (let dayOffset = 0; dayOffset < nights; dayOffset++) {
        const dayTime = dIn.getTime() + dayOffset * 86400000;
        if (occSet.has(dayTime)) {
          conflict = true;
          break;
        }
      }
      if (!conflict) {
        chosenRoom = candRoom;
        break;
      }
    }

    // If all existing rooms in property are booked on those nights, create next unit
    if (!chosenRoom) {
      const nextIdx = propInfo.rooms.length + 1;
      const newRoom = await prisma.room.create({
        data: {
          organizationId: org.id,
          propertyId: propInfo.property.id,
          roomTypeId: propInfo.roomType.id,
          number: `${propInfo.property.code}-${nextIdx}`,
          name: `${propInfo.property.name} (Unit ${nextIdx})`,
          status: "available",
        },
      });
      propInfo.rooms.push(newRoom);
      roomOccupancy.set(newRoom.id, new Set());
      chosenRoom = newRoom;
    }

    // Mark room occupancy
    const occSet = roomOccupancy.get(chosenRoom.id);
    for (let dayOffset = 0; dayOffset < nights; dayOffset++) {
      const dayTime = dIn.getTime() + dayOffset * 86400000;
      occSet.add(dayTime);
    }

    // Link ReservationRoom
    await prisma.reservationRoom.create({
      data: {
        organizationId: org.id,
        reservationId: reservation.id,
        roomId: chosenRoom.id,
        guestId: guest.id,
        nightlyRate: nights > 0 ? (rent / nights) : total,
      },
    });

    // Create RoomNights
    const perNightPrice = nights > 0 ? (rent / nights) : total;
    for (let dayOffset = 0; dayOffset < nights; dayOffset++) {
      const nightDate = new Date(dIn.getTime() + dayOffset * 86400000);
      nightDate.setUTCHours(0, 0, 0, 0);

      await prisma.roomNight.create({
        data: {
          organizationId: org.id,
          propertyId: propInfo.property.id,
          roomId: chosenRoom.id,
          reservationId: reservation.id,
          date: nightDate,
          status: "reserved",
          price: perNightPrice,
        },
      });
      roomNightsImported++;
    }

    // Invoice
    const invoiceNumber = `INV-${reservation.code}`;
    const invoiceStatus = guestDue <= 0.01 ? "paid" : guestPaid > 0 ? "partially_paid" : "issued";

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        propertyId: propInfo.property.id,
        reservationId: reservation.id,
        number: invoiceNumber,
        status: invoiceStatus,
        subtotal: rent,
        tax: tax,
        total: total,
        currency,
        notes: `Reservation ${shortCode} invoice for ${guestInfo.fullName}`,
        issueDate: sourceInfo.createdDate || dIn,
        dueDate: dOut,
        createdAt: sourceInfo.createdDate || dIn,
      },
    });
    invoicesImported++;

    // Line items
    await prisma.invoiceLineItem.create({
      data: {
        organizationId: org.id,
        invoiceId: invoice.id,
        description: `Accommodation (${nights} nights @ ${(rent / Math.max(1, nights)).toFixed(2)} / night)`,
        quantity: nights || 1,
        unitAmount: nights > 0 ? (rent / nights) : rent,
        total: rent,
      },
    });

    if (fees > 0) {
      await prisma.invoiceLineItem.create({
        data: {
          organizationId: org.id,
          invoiceId: invoice.id,
          description: "Cleaning & Hospitality Turnover Fee",
          quantity: 1,
          unitAmount: fees,
          total: fees,
        },
      });
    }

    if (tax > 0) {
      await prisma.invoiceLineItem.create({
        data: {
          organizationId: org.id,
          invoiceId: invoice.id,
          description: "Tourism & Municipal City Tax",
          quantity: 1,
          unitAmount: tax,
          total: tax,
        },
      });
    }

    // Payments
    if (guestPaid > 0) {
      await prisma.payment.create({
        data: {
          organizationId: org.id,
          propertyId: propInfo.property.id,
          reservationId: reservation.id,
          invoiceId: invoice.id,
          amount: guestPaid,
          currency,
          status: "captured",
          method: sourceInfo.channel === "airbnb" ? "ota_payout" : sourceInfo.channel === "booking_com" ? "virtual_card" : "credit_card",
          provider: sourceInfo.channel,
          providerRef: externalId && externalId !== "-" ? externalId : `PAY-${reservation.code}`,
          capturedAt: sourceInfo.createdDate || dIn,
          createdAt: sourceInfo.createdDate || dIn,
        },
      });
      paymentsImported++;
    }

    // Update GuestProfile spend & stays
    await prisma.guestProfile.updateMany({
      where: { organizationId: org.id, guestId: guest.id },
      data: {
        totalStays: { increment: 1 },
        totalSpent: { increment: guestPaid },
      },
    });

    bookingsImported++;
  }

  // Update room live status based on active occupancy
  const now = new Date();
  const todayZero = new Date(now.toISOString().slice(0, 10));
  const activeRoomNights = await prisma.roomNight.findMany({
    where: {
      organizationId: org.id,
      date: todayZero,
      status: "reserved",
    },
    select: { roomId: true },
  });
  const occupiedRoomIds = new Set(activeRoomNights.map((rn) => rn.roomId));

  for (const [, info] of propertyMap) {
    for (const r of info.rooms) {
      if (occupiedRoomIds.has(r.id)) {
        await prisma.room.update({
          where: { id: r.id },
          data: { status: "occupied" },
        });
      }
    }
  }

  // Audit log of import
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      action: "client_data.imported",
      entityType: "Organization",
      entityId: org.id,
      metadata: {
        summary: `Imported full booking report for The Penthouse Living: ${bookingsImported} reservations, ${roomNightsImported} room nights, ${invoicesImported} invoices, ${paymentsImported} payments.`,
        totalRevenueGbp: 282997.98,
        totalRevenueEur: 1212.8,
        totalNights: 590,
        agencyCommissionGbp: 153037.29,
        netDueOwnerGbp: 96484.26,
        propertiesCount: propertySpecs.length,
      },
    },
  });

  console.log(`\n=== RE-IMPORT COMPLETE ===`);
  console.log(`Organization: The Penthouse Living (${org.id})`);
  console.log(`Properties Created: ${propertySpecs.length}`);
  console.log(`Bookings Imported: ${bookingsImported}`);
  console.log(`Room Nights Generated: ${roomNightsImported}`);
  console.log(`Invoices Generated: ${invoicesImported}`);
  console.log(`Payments Captured: ${paymentsImported}`);

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("Re-import failed:", err);
  process.exit(1);
});
