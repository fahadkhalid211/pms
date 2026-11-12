import crypto from "crypto";
import { Prisma, ReservationSource, ReservationStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/ai/encryption";
import { hashPassword } from "@/lib/auth/passwords";
import { syncSystemRolesAndPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/audit";
import { getStayDatesArray, nightsBetween, toUtcMidnight } from "@/lib/reservations";
import { toISODate } from "@/lib/utils";

export const HOSPITABLE_API_BASE = "https://public.api.hospitable.com/v2";
export const HOSPITABLE_AUTH_URL = "https://auth.hospitable.com/oauth/authorize";
export const HOSPITABLE_TOKEN_URL = "https://auth.hospitable.com/oauth/token";

export interface HospitablePropertyPayload {
  id: string;
  name?: string;
  public_name?: string;
  picture?: string | null;
  time_zone?: string;
  currency?: string;
  summary?: string | null;
  description?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  address?: {
    street?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postcode?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  capacity?: {
    max?: number;
    bedrooms?: number;
    beds?: number;
    bathrooms?: number;
  } | null;
  details?: {
    max_guests?: number;
    guests?: number;
    bedrooms?: number;
  } | null;
  settings?: {
    check_in?: string | null;
    check_out?: string | null;
  } | null;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  owners?: Array<{
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  }> | null;
  listings?: Array<{
    platform?: string;
    platform_id?: string;
    public_name?: string;
    base_price?: number;
  }> | null;
}

export interface HospitableReservationPayload {
  id: string;
  code?: string | null;
  status?: string | null;
  reservation_status?: {
    current?: { category?: string; sub_category?: string };
  } | null;
  platform?: string | null;
  channel?: string | null;
  property_id?: string | null;
  property?: { id?: string; name?: string } | null;
  properties?: Array<{ id?: string; name?: string }> | null;
  arrival_date?: string | null;
  departure_date?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  nights?: number | null;
  guests?: {
    total?: number;
    adult_count?: number;
    child_count?: number;
  } | null;
  guests_count?: number | null;
  guest?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    phone_numbers?: string[] | null;
    locale?: string | null;
    location?: string | null;
  } | null;
  financials?: {
    currency?: string | null;
    host?: {
      accommodation?: { amount?: number | string };
      revenue?: { amount?: number | string };
      totals?: { total?: { amount?: number | string } };
    } | null;
    guest?: {
      total_price?: { amount?: number | string };
    } | null;
    total?: number | string | null;
  } | null;
  currency?: string | null;
  notes?: string | null;
}

export interface HospitablePropertyMapping {
  propertyId: string;
  roomTypeId: string;
  roomId: string;
}

export interface HospitableSyncSummary {
  propertiesImported: number;
  propertiesUpdated: number;
  usersImported: number;
  guestsImported: number;
  bookingsImported: number;
  bookingsUpdated: number;
  datesPushed: number;
  conflicts: string[];
  syncedAt: string;
}

export interface HospitableIntegrationConfig {
  authMode?: "oauth" | "pat";
  hospitableUserId?: string;
  hospitableUserName?: string;
  hospitableUserEmail?: string;
  webhookSecret?: string;
  propertyMap?: Record<string, HospitablePropertyMapping>;
  reservationMap?: Record<string, string>;
  lastSyncSummary?: HospitableSyncSummary;
}

function parseCheckHour(raw: string | null | undefined, fallback: number): number {
  if (!raw) return fallback;
  const match = /^(\d{1,2})/.exec(raw.trim());
  if (!match) return fallback;
  const hour = Number.parseInt(match[1], 10);
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : fallback;
}

function parseFinancialAmount(financials: HospitableReservationPayload["financials"]): Prisma.Decimal {
  if (!financials) return new Prisma.Decimal(0);

  const candidates = [
    financials.host?.revenue?.amount,
    financials.host?.totals?.total?.amount,
    financials.host?.accommodation?.amount,
    financials.guest?.total_price?.amount,
    financials.total,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      // Hospitable v2 financials amounts are returned in minor units (cents) as integers
      const value = Number.isInteger(candidate) && candidate >= 100 ? candidate / 100 : candidate;
      return new Prisma.Decimal(value.toFixed(2));
    }
    const parsed = Number.parseFloat(String(candidate));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return new Prisma.Decimal(parsed.toFixed(2));
    }
  }

  return new Prisma.Decimal(0);
}

function mapHospitableStatus(raw: HospitableReservationPayload): ReservationStatus {
  const rawStr = (
    raw.reservation_status?.current?.category ||
    raw.status ||
    "confirmed"
  )
    .toLowerCase()
    .trim();

  if (rawStr.includes("cancel") || rawStr.includes("declin") || rawStr.includes("void") || rawStr.includes("expir")) {
    return "cancelled";
  }
  if (rawStr.includes("check_in") || rawStr.includes("checked_in")) {
    return "checked_in";
  }
  if (rawStr.includes("check_out") || rawStr.includes("checked_out") || rawStr.includes("completed")) {
    return "checked_out";
  }
  if (rawStr.includes("pending") || rawStr.includes("request") || rawStr.includes("inquiry")) {
    return "pending";
  }
  return "confirmed";
}

function mapHospitableSource(raw: HospitableReservationPayload): { source: ReservationSource; channelLabel: string } {
  const channel = (raw.channel || raw.platform || "ota").toLowerCase().trim();
  if (channel === "direct" || channel === "manual") {
    return { source: "direct", channelLabel: channel };
  }
  return { source: "ota", channelLabel: channel || "ota" };
}

function splitFullName(name: string): { firstName: string; lastName: string } {
  const cleaned = name.trim();
  if (!cleaned) return { firstName: "Hospitable", lastName: "Guest" };
  const parts = cleaned.split(/\s+/);
  return {
    firstName: parts[0] || "Hospitable",
    lastName: parts.slice(1).join(" ") || "Guest",
  };
}

function readDecryptedObject(credentials: unknown): Record<string, string> {
  if (!credentials || typeof credentials !== "object") return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(credentials as Record<string, unknown>)) {
    if (typeof v === "string" && v) {
      try {
        result[k] = decryptSecret(v);
      } catch {
        // Ignore entries that fail decryption
      }
    }
  }
  return result;
}

/**
 * Resolves a valid Hospitable Bearer token for the integration, automatically
 * refreshing OAuth tokens when expired and client credentials are configured.
 */
export async function getHospitableAccessToken(organizationId: string, integrationId: string): Promise<string> {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId },
  });
  if (!integration) {
    throw new Error("Hospitable integration not found.");
  }

  const creds = readDecryptedObject(integration.credentials);
  const expiresAtMs = creds.expiresAt ? Number(creds.expiresAt) : 0;

  if (
    creds.refreshToken &&
    expiresAtMs > 0 &&
    Date.now() > expiresAtMs - 60_000 &&
    process.env.HOSPITABLE_CLIENT_ID &&
    process.env.HOSPITABLE_CLIENT_SECRET
  ) {
    const tokenRes = await fetch(HOSPITABLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: process.env.HOSPITABLE_CLIENT_ID,
        client_secret: process.env.HOSPITABLE_CLIENT_SECRET,
        refresh_token: creds.refreshToken,
      }),
    });

    if (tokenRes.ok) {
      const refreshed = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      const newExpiresAt = String(Date.now() + (refreshed.expires_in ?? 3600) * 1000);
      const nextCreds: Record<string, string> = {
        ...creds,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || creds.refreshToken,
        expiresAt: newExpiresAt,
      };
      const encrypted: Record<string, string> = {};
      for (const [k, v] of Object.entries(nextCreds)) {
        if (v) encrypted[k] = encryptSecret(v);
      }
      await prisma.integration.update({
        where: { id: integration.id },
        data: { credentials: encrypted, status: "connected", lastError: null },
      });
      return refreshed.access_token;
    }
  }

  const token = creds.accessToken || creds.apiKey;
  if (!token) {
    throw new Error("Missing Hospitable access token. Please reconnect your Hospitable account.");
  }
  return token;
}

export async function hospitableRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${HOSPITABLE_API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Hospitable API error (${res.status}): ${text.slice(0, 300)}`);
  }

  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

async function fetchAllHospitablePages<T>(token: string, initialPath: string): Promise<T[]> {
  const items: T[] = [];
  let nextPath: string | null = initialPath;
  let pageCount = 0;

  while (nextPath && pageCount < 50) {
    pageCount += 1;
    const response: {
      data?: T[];
      links?: { next?: string | null };
      meta?: { current_page?: number; last_page?: number };
    } = await hospitableRequest(token, nextPath);

    if (Array.isArray(response.data)) {
      items.push(...response.data);
    }

    if (response.links?.next) {
      nextPath = response.links.next;
    } else if (
      response.meta?.current_page &&
      response.meta?.last_page &&
      response.meta.current_page < response.meta.last_page
    ) {
      const separator = initialPath.includes("?") ? "&" : "?";
      nextPath = `${initialPath}${separator}page=${response.meta.current_page + 1}`;
    } else {
      nextPath = null;
    }
  }

  return items;
}

async function ensureHostUserFromHospitable(input: {
  organizationId: string;
  propertyId: string;
  owner: { id?: string; name?: string | null; email?: string | null; phone?: string | null };
}): Promise<{ created: boolean }> {
  const rawEmail = input.owner.email?.toLowerCase().trim();
  if (!rawEmail) return { created: false };

  const existing = await prisma.user.findUnique({ where: { email: rawEmail } });
  if (existing) {
    if (existing.organizationId === input.organizationId) {
      await prisma.propertyMembership.upsert({
        where: { propertyId_userId: { propertyId: input.propertyId, userId: existing.id } },
        update: { status: "active" },
        create: {
          organizationId: input.organizationId,
          propertyId: input.propertyId,
          userId: existing.id,
          isAdmin: existing.roleKey === "admin" || existing.roleKey === "manager",
          status: "active",
        },
      });
    }
    return { created: false };
  }

  let managerRole = await prisma.role.findFirst({
    where: { organizationId: input.organizationId, key: "manager" },
  });
  if (!managerRole) {
    await syncSystemRolesAndPermissions(input.organizationId);
    managerRole = await prisma.role.findFirst({
      where: { organizationId: input.organizationId, key: "manager" },
    });
  }

  const randomSecret = crypto.randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(randomSecret);
  const displayName = input.owner.name?.trim() || rawEmail.split("@")[0] || "Hospitable Host";

  await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: rawEmail,
        name: displayName,
        passwordHash,
        roleKey: "manager",
        organizationId: input.organizationId,
        status: "invited",
        propertyIds: [input.propertyId],
      },
    });

    await tx.organizationMembership.create({
      data: {
        organizationId: input.organizationId,
        userId: newUser.id,
        roleId: managerRole?.id ?? null,
        roleKey: "manager",
        status: "invited",
        propertyIds: [input.propertyId],
      },
    });

    await tx.propertyMembership.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        userId: newUser.id,
        isAdmin: true,
        status: "invited",
      },
    });
  });

  return { created: true };
}

/**
 * Upserts a Hospitable property (plus default RoomType, Room, and owner/user details)
 * into the organization workspace.
 */
export async function upsertHospitableProperty(input: {
  organizationId: string;
  hp: HospitablePropertyPayload;
  propertyMap: Record<string, HospitablePropertyMapping>;
}): Promise<{ mapping: HospitablePropertyMapping; created: boolean; usersAdded: number }> {
  const { organizationId, hp, propertyMap } = input;
  const code = `HSP-${hp.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
  const name = (hp.name || hp.public_name || `Hospitable Property ${code}`).trim();
  const owner = hp.user || hp.owners?.[0] || null;
  const checkInTime = parseCheckHour(hp.settings?.check_in || hp.check_in, 15);
  const checkOutTime = parseCheckHour(hp.settings?.check_out || hp.check_out, 11);
  const capacity = hp.capacity?.max || hp.details?.max_guests || hp.details?.guests || 2;
  const listingBaseRate = hp.listings?.find((l) => typeof l.base_price === "number" && l.base_price > 0)?.base_price;
  const baseRate = new Prisma.Decimal(listingBaseRate ? listingBaseRate.toFixed(2) : "150.00");

  const mapped = propertyMap[hp.id];
  let property = mapped?.propertyId
    ? await prisma.property.findFirst({ where: { id: mapped.propertyId, organizationId } })
    : null;

  if (!property) {
    property = await prisma.property.findFirst({
      where: { organizationId, code },
    });
  }

  let created = false;
  if (!property) {
    created = true;
    property = await prisma.property.create({
      data: {
        organizationId,
        name,
        code,
        addressLine1: hp.address?.street || hp.address?.address || null,
        city: hp.address?.city || null,
        state: hp.address?.state || null,
        postalCode: hp.address?.postal_code || hp.address?.postcode || null,
        country: hp.address?.country || null,
        timezone: hp.time_zone || "UTC",
        currency: (hp.currency || "USD").toUpperCase().slice(0, 3),
        email: owner?.email || null,
        phone: owner?.phone || null,
        checkInTime,
        checkOutTime,
        description: hp.summary || hp.description || `Synced from Hospitable (${hp.id})`,
        status: "active",
      },
    });
  } else {
    property = await prisma.property.update({
      where: { id: property.id },
      data: {
        name,
        addressLine1: hp.address?.street || hp.address?.address || property.addressLine1,
        city: hp.address?.city || property.city,
        state: hp.address?.state || property.state,
        postalCode: hp.address?.postal_code || hp.address?.postcode || property.postalCode,
        country: hp.address?.country || property.country,
        timezone: hp.time_zone || property.timezone,
        currency: (hp.currency || property.currency || "USD").toUpperCase().slice(0, 3),
        email: owner?.email || property.email,
        phone: owner?.phone || property.phone,
        checkInTime,
        checkOutTime,
      },
    });
  }

  // Ensure default RoomType & Room exist so bookings & RoomNights map directly
  let roomType = mapped?.roomTypeId
    ? await prisma.roomType.findFirst({ where: { id: mapped.roomTypeId, propertyId: property.id } })
    : null;
  if (!roomType) {
    roomType = await prisma.roomType.upsert({
      where: { propertyId_name: { propertyId: property.id, name: "Entire Property" } },
      update: { capacity },
      create: {
        organizationId,
        propertyId: property.id,
        name: "Entire Property",
        capacity,
        baseRate,
      },
    });
  }

  let room = mapped?.roomId
    ? await prisma.room.findFirst({ where: { id: mapped.roomId, propertyId: property.id } })
    : null;
  if (!room) {
    room = await prisma.room.upsert({
      where: { propertyId_number: { propertyId: property.id, number: "MAIN" } },
      update: { roomTypeId: roomType.id, name },
      create: {
        organizationId,
        propertyId: property.id,
        roomTypeId: roomType.id,
        number: "MAIN",
        name,
        status: "available",
      },
    });
  }

  let usersAdded = 0;
  if (owner?.email) {
    const userRes = await ensureHostUserFromHospitable({
      organizationId,
      propertyId: property.id,
      owner,
    });
    if (userRes.created) usersAdded += 1;
  }

  const nextMapping: HospitablePropertyMapping = {
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomId: room.id,
  };
  propertyMap[hp.id] = nextMapping;

  return { mapping: nextMapping, created, usersAdded };
}

/**
 * Upserts a Hospitable reservation and its guest details idempotently,
 * maintaining atomic RoomNight locks and releasing them on cancellation.
 */
export async function upsertHospitableReservation(input: {
  organizationId: string;
  hr: HospitableReservationPayload;
  propertyMap: Record<string, HospitablePropertyMapping>;
  reservationMap: Record<string, string>;
}): Promise<{ created: boolean; updated: boolean; guestAdded: boolean; conflict?: string }> {
  const { organizationId, hr, propertyMap, reservationMap } = input;
  const hospitablePropId = hr.property_id || hr.property?.id || hr.properties?.[0]?.id;
  if (!hospitablePropId || !propertyMap[hospitablePropId]) {
    return {
      created: false,
      updated: false,
      guestAdded: false,
      conflict: `Skipped reservation ${hr.code || hr.id}: Hospitable property ${hospitablePropId || "unknown"} not mapped.`,
    };
  }

  const mapping = propertyMap[hospitablePropId];
  const rawCheckIn = hr.arrival_date || hr.check_in || hr.start_date;
  const rawCheckOut = hr.departure_date || hr.check_out || hr.end_date;
  if (!rawCheckIn || !rawCheckOut) {
    return { created: false, updated: false, guestAdded: false, conflict: `Missing dates on reservation ${hr.id}` };
  }

  const checkIn = toUtcMidnight(rawCheckIn);
  const checkOut = toUtcMidnight(rawCheckOut);
  if (nightsBetween(checkIn, checkOut) <= 0) {
    return { created: false, updated: false, guestAdded: false, conflict: `Invalid dates on reservation ${hr.id}` };
  }

  // 1. Upsert Guest + GuestProfile details
  const gEmail = hr.guest?.email?.toLowerCase().trim() || null;
  const gPhone = hr.guest?.phone || hr.guest?.phone_numbers?.[0] || null;
  const firstName = hr.guest?.first_name?.trim() || "Hospitable";
  const lastName = hr.guest?.last_name?.trim() || "Guest";
  const { source, channelLabel } = mapHospitableSource(hr);

  let guest = gEmail
    ? await prisma.guest.findFirst({ where: { organizationId, email: gEmail } })
    : await prisma.guest.findFirst({
        where: { organizationId, firstName, lastName, ...(gPhone ? { phone: gPhone } : {}) },
      });

  let guestAdded = false;
  if (!guest) {
    guestAdded = true;
    guest = await prisma.guest.create({
      data: {
        organizationId,
        firstName,
        lastName,
        email: gEmail,
        phone: gPhone,
        notes: [hr.guest?.location ? `Location: ${hr.guest.location}` : null, `Hospitable channel: ${channelLabel}`]
          .filter(Boolean)
          .join(" | "),
      },
    });
  } else {
    guest = await prisma.guest.update({
      where: { id: guest.id },
      data: {
        firstName,
        lastName,
        phone: gPhone || guest.phone,
        email: gEmail || guest.email,
      },
    });
  }

  await prisma.guestProfile.upsert({
    where: { guestId: guest.id },
    update: {
      preferences: {
        source: "hospitable",
        channel: channelLabel,
        locale: hr.guest?.locale || undefined,
        location: hr.guest?.location || undefined,
        externalGuestId: hr.guest?.id || undefined,
      },
    },
    create: {
      organizationId,
      guestId: guest.id,
      preferences: {
        source: "hospitable",
        channel: channelLabel,
        locale: hr.guest?.locale || undefined,
        location: hr.guest?.location || undefined,
        externalGuestId: hr.guest?.id || undefined,
      },
    },
  });

  // 2. Determine Reservation status, code, totals
  const status = mapHospitableStatus(hr);
  const code = `HSP-${(hr.code || hr.id).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24).toUpperCase()}`;
  const totalAmount = parseFinancialAmount(hr.financials);
  const currency = (hr.financials?.currency || hr.currency || "USD").toUpperCase().slice(0, 3);
  const adults = Math.max(1, hr.guests?.adult_count ?? hr.guests_count ?? hr.guests?.total ?? 1);
  const children = Math.max(0, hr.guests?.child_count ?? 0);
  const stayDates = getStayDatesArray(checkIn, checkOut);
  const perNightPrice =
    stayDates.length > 0 ? totalAmount.dividedBy(stayDates.length).toDecimalPlaces(2) : new Prisma.Decimal(0);

  const existingId = reservationMap[hr.id];
  const existing = existingId
    ? await prisma.reservation.findFirst({ where: { id: existingId, organizationId } })
    : await prisma.reservation.findFirst({ where: { organizationId, code } });

  try {
    if (existing) {
      await prisma.$transaction(async (tx) => {
        if (status === "cancelled" || status === "no_show") {
          await tx.roomNight.deleteMany({ where: { reservationId: existing.id, organizationId } });
        } else if (
          toISODate(existing.checkIn) !== toISODate(checkIn) ||
          toISODate(existing.checkOut) !== toISODate(checkOut)
        ) {
          await tx.roomNight.deleteMany({ where: { reservationId: existing.id, organizationId } });
          for (const nightDate of stayDates) {
            await tx.roomNight.create({
              data: {
                organizationId,
                propertyId: mapping.propertyId,
                roomId: mapping.roomId,
                reservationId: existing.id,
                date: nightDate,
                status: "reserved",
                price: perNightPrice,
              },
            });
          }
        }

        await tx.reservation.update({
          where: { id: existing.id },
          data: {
            status,
            checkIn,
            checkOut,
            adults,
            children,
            guestId: guest.id,
            source,
            totalAmount,
            currency,
            cancelledAt: status === "cancelled" ? existing.cancelledAt ?? new Date() : null,
            notes: `[Hospitable · ${channelLabel}]${hr.notes ? ` ${hr.notes}` : ""}`,
          },
        });
      });

      reservationMap[hr.id] = existing.id;
      return { created: false, updated: true, guestAdded };
    }

    const createdRes = await prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          organizationId,
          propertyId: mapping.propertyId,
          code,
          status,
          checkIn,
          checkOut,
          adults,
          children,
          guestId: guest.id,
          source,
          totalAmount,
          currency,
          cancelledAt: status === "cancelled" ? new Date() : null,
          notes: `[Hospitable · ${channelLabel}]${hr.notes ? ` ${hr.notes}` : ""}`,
        },
      });

      await tx.reservationRoom.create({
        data: {
          organizationId,
          reservationId: created.id,
          roomId: mapping.roomId,
          guestId: guest.id,
          nightlyRate: perNightPrice,
        },
      });

      if (status !== "cancelled" && status !== "no_show") {
        for (const nightDate of stayDates) {
          await tx.roomNight.create({
            data: {
              organizationId,
              propertyId: mapping.propertyId,
              roomId: mapping.roomId,
              reservationId: created.id,
              date: nightDate,
              status: "reserved",
              price: perNightPrice,
            },
          });
        }
      }

      return created;
    });

    reservationMap[hr.id] = createdRes.id;
    return { created: true, updated: false, guestAdded };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e?.code === "P2002" || e?.code === "P2034") {
      return {
        created: false,
        updated: false,
        guestAdded,
        conflict: `Date conflict on ${code} (${toISODate(checkIn)} to ${toISODate(checkOut)}): dates already booked locally.`,
      };
    }
    throw err;
  }
}

/**
 * Pushes local PMS availability (blocked/reserved vs available dates) out to Hospitable.
 */
export async function pushPropertyDatesToHospitable(input: {
  organizationId: string;
  propertyId: string;
  dates: Date[];
}): Promise<number> {
  if (input.dates.length === 0) return 0;

  const integrations = await prisma.integration.findMany({
    where: {
      organizationId: input.organizationId,
      provider: "hospitable",
      status: "connected",
    },
  });

  if (integrations.length === 0) return 0;

  let totalPushed = 0;

  for (const integration of integrations) {
    const config = (integration.config || {}) as HospitableIntegrationConfig;
    const propertyMap = config.propertyMap || {};
    const matchedEntries = Object.entries(propertyMap).filter(([, m]) => m.propertyId === input.propertyId);
    if (matchedEntries.length === 0) continue;

    try {
      const token = await getHospitableAccessToken(input.organizationId, integration.id);
      const uniqueDateIsoList = Array.from(new Set(input.dates.map((d) => toISODate(d))));

      // Check current DB roomNights for each date on this property
      const occupiedNights = await prisma.roomNight.findMany({
        where: {
          organizationId: input.organizationId,
          propertyId: input.propertyId,
          date: { in: uniqueDateIsoList.map((iso) => toUtcMidnight(iso)) },
          status: { in: ["reserved", "blocked", "maintenance"] },
        },
        select: { date: true },
      });

      const occupiedSet = new Set(occupiedNights.map((n) => toISODate(n.date)));
      const calendarDates = uniqueDateIsoList.map((dateStr) => ({
        date: dateStr,
        available: !occupiedSet.has(dateStr),
      }));

      for (const [hospitableUuid] of matchedEntries) {
        await hospitableRequest(token, `/properties/${hospitableUuid}/calendar`, {
          method: "PUT",
          body: JSON.stringify({ dates: calendarDates }),
        });
        totalPushed += calendarDates.length;
      }

      await prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastError: null },
      });
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "Outbound calendar push failed";
      await prisma.integration.update({
        where: { id: integration.id },
        data: { lastError: `Outbound push warning: ${msg}` },
      });
    }
  }

  return totalPushed;
}

/**
 * Full Two-Way Sync with Hospitable:
 * 1. Pulls properties + host/owner user details from Hospitable
 * 2. Pulls bookings/reservations + guest user details from Hospitable
 * 3. Pushes local PMS bookings/blocks outbound to Hospitable calendar
 */
export async function syncHospitableTwoWay(input: {
  organizationId: string;
  integrationId: string;
  userId?: string;
}): Promise<HospitableSyncSummary> {
  const integration = await prisma.integration.findFirst({
    where: { id: input.integrationId, organizationId: input.organizationId, provider: "hospitable" },
  });
  if (!integration) {
    throw new Error("Hospitable integration not found.");
  }

  const config: HospitableIntegrationConfig = {
    ...((integration.config as HospitableIntegrationConfig) || {}),
  };
  const propertyMap: Record<string, HospitablePropertyMapping> = { ...(config.propertyMap || {}) };
  const reservationMap: Record<string, string> = { ...(config.reservationMap || {}) };

  const summary: HospitableSyncSummary = {
    propertiesImported: 0,
    propertiesUpdated: 0,
    usersImported: 0,
    guestsImported: 0,
    bookingsImported: 0,
    bookingsUpdated: 0,
    datesPushed: 0,
    conflicts: [],
    syncedAt: new Date().toISOString(),
  };

  try {
    const token = await getHospitableAccessToken(input.organizationId, integration.id);

    // 1. Pull Properties & Owner User Details
    const properties = await fetchAllHospitablePages<HospitablePropertyPayload>(
      token,
      "/properties?include=user,listings,details&per_page=50",
    );

    for (const hp of properties) {
      if (hp.user && !config.hospitableUserEmail) {
        config.hospitableUserId = hp.user.id || config.hospitableUserId;
        config.hospitableUserEmail = hp.user.email || config.hospitableUserEmail;
        config.hospitableUserName = hp.user.name || config.hospitableUserName;
      }

      const result = await upsertHospitableProperty({
        organizationId: input.organizationId,
        hp,
        propertyMap,
      });
      if (result.created) summary.propertiesImported += 1;
      else summary.propertiesUpdated += 1;
      summary.usersImported += result.usersAdded;
    }

    // 2. Pull Reservations & Guest Details (Hospitable v2 requires properties[] query param)
    const propertyUuids = properties.map((p) => p.id).filter(Boolean);
    const reservations: HospitableReservationPayload[] = [];

    for (let i = 0; i < propertyUuids.length; i += 20) {
      const batch = propertyUuids.slice(i, i + 20);
      const propQuery = batch.map((id) => `properties[]=${encodeURIComponent(id)}`).join("&");
      let batchReservations: HospitableReservationPayload[] = [];
      try {
        batchReservations = await fetchAllHospitablePages<HospitableReservationPayload>(
          token,
          `/reservations?${propQuery}&include=guest,financials,properties,listings&per_page=50`,
        );
      } catch (resErr: unknown) {
        const msg = (resErr as Error).message || "";
        // Fallback if token lacks financials/listings scope
        if (msg.includes("(403)") || msg.includes("scope")) {
          batchReservations = await fetchAllHospitablePages<HospitableReservationPayload>(
            token,
            `/reservations?${propQuery}&include=guest,properties&per_page=50`,
          );
        } else {
          throw resErr;
        }
      }
      reservations.push(...batchReservations);
    }

    for (const hr of reservations) {
      const resResult = await upsertHospitableReservation({
        organizationId: input.organizationId,
        hr,
        propertyMap,
        reservationMap,
      });
      if (resResult.created) summary.bookingsImported += 1;
      if (resResult.updated) summary.bookingsUpdated += 1;
      if (resResult.guestAdded) summary.guestsImported += 1;
      if (resResult.conflict) summary.conflicts.push(resResult.conflict);
    }

    // 3. Push Local PMS-Originated Bookings/Blocks Outbound to Hospitable (Two-Way)
    const today = toUtcMidnight(new Date());
    const horizon = new Date(today.getTime() + 180 * 86400000);

    for (const [hospitableUuid, mapping] of Object.entries(propertyMap)) {
      const localNights = await prisma.roomNight.findMany({
        where: {
          organizationId: input.organizationId,
          propertyId: mapping.propertyId,
          date: { gte: today, lte: horizon },
          status: { in: ["reserved", "blocked", "maintenance"] },
          OR: [
            { reservationId: null },
            { reservation: { NOT: { code: { startsWith: "HSP-" } } } },
          ],
        },
        select: { date: true },
      });

      if (localNights.length > 0) {
        const uniqueDates = Array.from(new Set(localNights.map((n) => toISODate(n.date)))).map((d) => ({
          date: d,
          available: false,
        }));
        try {
          await hospitableRequest(token, `/properties/${hospitableUuid}/calendar`, {
            method: "PUT",
            body: JSON.stringify({ dates: uniqueDates }),
          });
          summary.datesPushed += uniqueDates.length;
        } catch (pushErr: unknown) {
          summary.conflicts.push(
            `Outbound calendar push skipped for ${hospitableUuid}: ${(pushErr as Error).message}`,
          );
        }
      }
    }

    // Persist updated mappings & summary
    config.propertyMap = propertyMap;
    config.reservationMap = reservationMap;
    config.lastSyncSummary = summary;

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "connected",
        config: config as unknown as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
        lastError: summary.conflicts.length > 0 ? summary.conflicts[0] : null,
      },
    });

    await logActivity({
      organizationId: input.organizationId,
      userId: input.userId,
      source: "backend",
      category: "operations",
      action: "hospitable.two_way_sync",
      summary: `Hospitable 2-way sync: ${summary.propertiesImported} properties imported, ${summary.bookingsImported} bookings imported, ${summary.guestsImported} guests, ${summary.datesPushed} dates pushed.`,
      entityType: "Integration",
      entityId: integration.id,
      metadata: summary as unknown as Record<string, unknown>,
    });

    return summary;
  } catch (err: unknown) {
    const errorMessage = (err as Error).message ?? "Hospitable two-way sync failed";
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "error",
        lastError: errorMessage,
      },
    });
    throw err;
  }
}

/**
 * Processes real-time Hospitable webhook events (reservation/property changes).
 */
export async function processHospitableWebhook(input: {
  organizationId: string;
  integrationId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const integration = input.integrationId
    ? await prisma.integration.findFirst({
        where: { id: input.integrationId, organizationId: input.organizationId },
      })
    : await prisma.integration.findFirst({
        where: { organizationId: input.organizationId, provider: "hospitable" },
      });

  if (!integration) return;

  const config: HospitableIntegrationConfig = {
    ...((integration.config as HospitableIntegrationConfig) || {}),
  };
  const propertyMap = { ...(config.propertyMap || {}) };
  const reservationMap = { ...(config.reservationMap || {}) };
  const data = (input.payload.data || input.payload) as Record<string, unknown>;

  if (input.eventType.startsWith("property.") && data?.id) {
    await upsertHospitableProperty({
      organizationId: input.organizationId,
      hp: data as unknown as HospitablePropertyPayload,
      propertyMap,
    });
  } else if (input.eventType.startsWith("reservation.") && data?.id) {
    const hr = data as unknown as HospitableReservationPayload;
    const propId = hr.property_id || hr.property?.id || hr.properties?.[0]?.id;
    if (propId && !propertyMap[propId] && hr.property) {
      await upsertHospitableProperty({
        organizationId: input.organizationId,
        hp: hr.property as HospitablePropertyPayload,
        propertyMap,
      });
    }
    await upsertHospitableReservation({
      organizationId: input.organizationId,
      hr,
      propertyMap,
      reservationMap,
    });
  }

  config.propertyMap = propertyMap;
  config.reservationMap = reservationMap;

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      config: config as unknown as Prisma.InputJsonValue,
      lastSyncAt: new Date(),
    },
  });
}
