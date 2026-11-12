import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { encryptSecret } from "@/lib/ai/encryption";
import { parseIcalEvents } from "@/lib/integrations";
import { getStayDatesArray, nightsBetween, toUtcMidnight } from "@/lib/reservations";
import { logActivity } from "@/lib/audit";
import { HOSPITABLE_AUTH_URL } from "@/lib/integrations/hospitable";

export interface OAuthStatePayload {
  organizationId: string;
  userId: string;
  provider: "hospitable" | "airbnb" | "airbnb_ical" | "booking_com";
  propertyId?: string;
}

function getStateSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "lumina-dev-only-insecure-secret-change-me-32b";
  return new TextEncoder().encode(secret);
}

export async function createOAuthStateToken(payload: OAuthStatePayload): Promise<string> {
  return new SignJWT({ ...payload, nonce: crypto.randomBytes(12).toString("hex") })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getStateSecret());
}

export async function verifyOAuthStateToken(token: string): Promise<OAuthStatePayload> {
  const { payload } = await jwtVerify(token, getStateSecret());
  if (!payload.organizationId || !payload.userId || !payload.provider) {
    throw new Error("Invalid OAuth state payload.");
  }
  return {
    organizationId: String(payload.organizationId),
    userId: String(payload.userId),
    provider: String(payload.provider) as OAuthStatePayload["provider"],
    propertyId: payload.propertyId ? String(payload.propertyId) : undefined,
  };
}

/**
 * Validates that an external iCal URL uses HTTPS and does not target
 * localhost, loopback, or private/link-local IP ranges (SSRF guard).
 */
export function validateExternalIcalUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid calendar URL format.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("External calendar URL must use HTTPS.");
  }

  const host = parsed.hostname.toLowerCase();
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^169\.254\./,
    /^0\.0\.0\.0$/,
    /^\[?::1\]?$/,
    /^\[?fe80:/i,
    /^\[?fc00:/i,
    /^\[?fd/i,
  ];

  if (blockedPatterns.some((re) => re.test(host))) {
    throw new Error("Refusing private or loopback calendar URL.");
  }

  return parsed;
}

function parseCompactIcsDate(compact: string): Date | null {
  if (!/^\d{8}$/.test(compact)) return null;
  const year = Number.parseInt(compact.slice(0, 4), 10);
  const month = Number.parseInt(compact.slice(4, 6), 10) - 1;
  const day = Number.parseInt(compact.slice(6, 8), 10);
  return new Date(Date.UTC(year, month, day));
}

export interface IcalSyncResult {
  eventsFound: number;
  imported: number;
  updated: number;
  conflicts: string[];
}

/**
 * Pulls an external .ics calendar feed (Airbnb, Booking.com, VRBO) and
 * upserts confirmed OTA reservations + RoomNight blocks for the target property.
 */
export async function syncExternalIcalCalendar(input: {
  organizationId: string;
  propertyId: string;
  provider: string;
  icalUrl: string;
  userId?: string;
  integrationId?: string;
}): Promise<IcalSyncResult> {
  const safeUrl = validateExternalIcalUrl(input.icalUrl);

  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, organizationId: input.organizationId },
    include: {
      rooms: { include: { roomType: true }, orderBy: { number: "asc" } },
    },
  });
  if (!property) {
    throw new Error("Target property not found or unauthorized.");
  }
  if (property.rooms.length === 0) {
    throw new Error("Target property has no rooms configured. Add at least one room first.");
  }

  const res = await fetch(safeUrl.toString(), {
    headers: { Accept: "text/calendar, text/plain" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch calendar feed (${res.status} ${res.statusText}).`);
  }

  const icsText = await res.text();
  if (!icsText.includes("BEGIN:VCALENDAR")) {
    throw new Error("URL did not return a valid RFC 5545 iCalendar (.ics) feed.");
  }

  const events = parseIcalEvents(icsText);
  const targetRoom = property.rooms[0];

  const result: IcalSyncResult = {
    eventsFound: events.length,
    imported: 0,
    updated: 0,
    conflicts: [],
  };

  for (const ev of events) {
    const start = parseCompactIcsDate(ev.startDate);
    const end = parseCompactIcsDate(ev.endDate);
    if (!start || !end || nightsBetween(start, end) <= 0) continue;

    const uidHash = crypto.createHash("sha256").update(`${input.provider}:${ev.uid}`).digest("hex").slice(0, 12).toUpperCase();
    const code = `ICS-${uidHash}`;
    const stayDates = getStayDatesArray(start, end);
    const rate = targetRoom.roomType?.baseRate ?? new Prisma.Decimal(0);
    const totalAmount = new Prisma.Decimal(rate).mul(stayDates.length).toDecimalPlaces(2);

    const existing = await prisma.reservation.findFirst({
      where: { organizationId: input.organizationId, code },
    });

    try {
      if (existing) {
        const checkInSame = toUtcMidnight(existing.checkIn).getTime() === start.getTime();
        const checkOutSame = toUtcMidnight(existing.checkOut).getTime() === end.getTime();
        if (!checkInSame || !checkOutSame) {
          await prisma.$transaction(async (tx) => {
            await tx.roomNight.deleteMany({
              where: { reservationId: existing.id, organizationId: input.organizationId },
            });
            for (const d of stayDates) {
              await tx.roomNight.create({
                data: {
                  organizationId: input.organizationId,
                  propertyId: property.id,
                  roomId: targetRoom.id,
                  reservationId: existing.id,
                  date: d,
                  status: "reserved",
                  price: rate,
                },
              });
            }
            await tx.reservation.update({
              where: { id: existing.id },
              data: { checkIn: start, checkOut: end, totalAmount },
            });
          });
          result.updated += 1;
        }
        continue;
      }

      // Ensure a synthetic channel guest record exists for external iCal blocks
      const channelLabel = input.provider.replace("_ical", "");
      let guest = await prisma.guest.findFirst({
        where: {
          organizationId: input.organizationId,
          email: `${channelLabel}.sync@external.channel`,
        },
      });
      if (!guest) {
        guest = await prisma.guest.create({
          data: {
            organizationId: input.organizationId,
            firstName: channelLabel.toUpperCase(),
            lastName: "Guest",
            email: `${channelLabel}.sync@external.channel`,
          },
        });
      }

      await prisma.$transaction(async (tx) => {
        const created = await tx.reservation.create({
          data: {
            organizationId: input.organizationId,
            propertyId: property.id,
            code,
            status: "confirmed",
            checkIn: start,
            checkOut: end,
            adults: 1,
            guestId: guest.id,
            source: "ota",
            totalAmount,
            currency: property.currency || "USD",
            notes: `[${channelLabel} iCal Sync] ${ev.summary} (UID: ${ev.uid})`,
          },
        });

        await tx.reservationRoom.create({
          data: {
            organizationId: input.organizationId,
            reservationId: created.id,
            roomId: targetRoom.id,
            guestId: guest.id,
            nightlyRate: rate,
          },
        });

        for (const d of stayDates) {
          await tx.roomNight.create({
            data: {
              organizationId: input.organizationId,
              propertyId: property.id,
              roomId: targetRoom.id,
              reservationId: created.id,
              date: d,
              status: "reserved",
              price: rate,
            },
          });
        }
      });

      result.imported += 1;
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === "P2002" || e?.code === "P2034") {
        result.conflicts.push(`Date conflict for ${ev.summary} (${ev.startDate}-${ev.endDate})`);
      } else {
        throw err;
      }
    }
  }

  if (input.integrationId) {
    await prisma.integration.updateMany({
      where: { id: input.integrationId, organizationId: input.organizationId },
      data: {
        status: "connected",
        lastSyncAt: new Date(),
        lastError: result.conflicts[0] ?? null,
        credentials: { icalImportUrl: encryptSecret(safeUrl.toString()) },
        config: {
          icalImportUrlMasked: `${safeUrl.origin}/...`,
          lastIcalResult: result,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  await logActivity({
    organizationId: input.organizationId,
    propertyId: property.id,
    userId: input.userId,
    source: "backend",
    category: "operations",
    action: "integration.ical_synced",
    summary: `Synced ${input.provider} calendar for ${property.name}: ${result.imported} imported, ${result.updated} updated.`,
    metadata: result as unknown as Record<string, unknown>,
  });

  return result;
}

export interface AuthorizePlanResponse {
  mode: "oauth_redirect" | "hospitable_connect_redirect" | "guided_channel_login";
  provider: string;
  authorizeUrl: string;
  note: string;
}

/**
 * Resolves the sign-in flow URL for Hospitable, Airbnb, or Booking.com:
 * - Uses native OAuth 2.0 when partner client credentials are configured
 * - Uses Hospitable Connect magic link when HOSPITABLE_CONNECT_TOKEN is configured
 * - Otherwise opens the official platform host login URL for guided 2-way channel connect
 */
export async function resolveOAuthAuthorizePlan(input: {
  origin: string;
  organizationId: string;
  userId: string;
  provider: "hospitable" | "airbnb" | "airbnb_ical" | "booking_com";
  propertyId?: string;
}): Promise<AuthorizePlanResponse> {
  const state = await createOAuthStateToken({
    organizationId: input.organizationId,
    userId: input.userId,
    provider: input.provider,
    propertyId: input.propertyId,
  });
  const redirectUri = `${input.origin}/api/integrations/oauth/callback`;

  if (input.provider === "hospitable") {
    if (process.env.HOSPITABLE_CLIENT_ID) {
      const url = new URL(HOSPITABLE_AUTH_URL);
      url.searchParams.set("client_id", process.env.HOSPITABLE_CLIENT_ID);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);
      return {
        mode: "oauth_redirect",
        provider: "hospitable",
        authorizeUrl: url.toString(),
        note: "Redirecting to Hospitable OAuth sign-in...",
      };
    }

    return {
      mode: "guided_channel_login",
      provider: "hospitable",
      authorizeUrl: "https://my.hospitable.com/apps/api-access",
      note: "Sign in to Hospitable, create a Personal Access Token under Apps > API access, and paste it here to enable full 2-way sync.",
    };
  }

  // Airbnb / Booking.com via Hospitable Connect Partner API (if configured)
  if (process.env.HOSPITABLE_CONNECT_TOKEN) {
    const channel = input.provider === "booking_com" ? "booking" : "airbnb";
    try {
      const org = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { id: true, name: true },
      });
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true },
      });

      await fetch("https://connect.hospitable.com/api/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HOSPITABLE_CONNECT_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id: input.organizationId,
          email: user?.email,
          name: org?.name || user?.name || "Lumina Host",
        }),
      });

      const authCodeRes = await fetch("https://connect.hospitable.com/api/v1/auth-codes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HOSPITABLE_CONNECT_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          customer_id: input.organizationId,
          redirect_url: `${redirectUri}?state=${encodeURIComponent(state)}`,
          channel,
        }),
      });

      if (authCodeRes.ok) {
        const json = (await authCodeRes.json()) as { data?: { return_url?: string }; return_url?: string };
        const magicUrl = json.data?.return_url || json.return_url;
        if (magicUrl) {
          return {
            mode: "hospitable_connect_redirect",
            provider: input.provider,
            authorizeUrl: magicUrl,
            note: "Opening Hospitable Connect channel sign-in...",
          };
        }
      }
    } catch {
      // Fall through cleanly to direct partner / guided channel flow
    }
  }

  // Direct Airbnb Partner OAuth (when approved partner credentials exist)
  if ((input.provider === "airbnb" || input.provider === "airbnb_ical") && process.env.AIRBNB_CLIENT_ID) {
    const airbnbAuth = new URL("https://www.airbnb.com/oauth2/auth");
    airbnbAuth.searchParams.set("client_id", process.env.AIRBNB_CLIENT_ID);
    airbnbAuth.searchParams.set("redirect_uri", redirectUri);
    airbnbAuth.searchParams.set("response_type", "code");
    airbnbAuth.searchParams.set("scope", "listings_read reservations_read messages_read");
    airbnbAuth.searchParams.set("state", state);
    return {
      mode: "oauth_redirect",
      provider: input.provider,
      authorizeUrl: airbnbAuth.toString(),
      note: "Redirecting to Airbnb Partner OAuth...",
    };
  }

  // Standard host flow when official OTA Partner OAuth credentials are not configured:
  // Opens official Airbnb Hosting or Booking.com Extranet sign-in + guides 2-way sync completion
  const isBooking = input.provider === "booking_com";
  return {
    mode: "guided_channel_login",
    provider: input.provider,
    authorizeUrl: isBooking ? "https://admin.booking.com" : "https://www.airbnb.com/hosting/listings",
    note: isBooking
      ? "Booking.com does not provide a public OAuth login for arbitrary apps. Sign in to Booking.com Extranet to connect via Hospitable or sync your calendar feed."
      : "Airbnb restricts direct OAuth logins to approved Connectivity Partners. Sign in to Airbnb Hosting to link your listing calendar or connect via Hospitable for full API sync.",
  };
}
