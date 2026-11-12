import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { saveIntegrationCredentials } from "@/lib/integrations";
import { HOSPITABLE_TOKEN_URL, syncHospitableTwoWay } from "@/lib/integrations/hospitable";
import { verifyOAuthStateToken } from "@/lib/integrations/ota";
import { logActivity } from "@/lib/audit";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const appOrigin = process.env.AUTH_URL?.replace(/\/$/, "") || origin;

  const errorParam = searchParams.get("error");
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (errorParam) {
    return NextResponse.redirect(
      `${appOrigin}/integrations?oauth_error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!stateParam) {
    return NextResponse.redirect(
      `${appOrigin}/integrations?oauth_error=${encodeURIComponent("Missing OAuth state parameter.")}`,
    );
  }

  try {
    const state = await verifyOAuthStateToken(stateParam);
    const redirectUri = `${appOrigin}/api/integrations/oauth/callback`;

    if (state.provider === "hospitable") {
      if (!code || !process.env.HOSPITABLE_CLIENT_ID || !process.env.HOSPITABLE_CLIENT_SECRET) {
        return NextResponse.redirect(
          `${appOrigin}/integrations?oauth_error=${encodeURIComponent("Hospitable OAuth client credentials are not configured.")}`,
        );
      }

      const tokenRes = await fetch(HOSPITABLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: process.env.HOSPITABLE_CLIENT_ID,
          client_secret: process.env.HOSPITABLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          code,
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text().catch(() => "Token exchange failed");
        return NextResponse.redirect(
          `${appOrigin}/integrations?oauth_error=${encodeURIComponent(errBody.slice(0, 180))}`,
        );
      }

      const tokenJson = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      let integration = await prisma.integration.findFirst({
        where: { organizationId: state.organizationId, provider: "hospitable" },
      });
      if (!integration) {
        integration = await prisma.integration.create({
          data: {
            organizationId: state.organizationId,
            provider: "hospitable",
            name: "Hospitable Two-Way Sync",
            status: "connected",
            config: { authMode: "oauth" },
          },
        });
      }

      await saveIntegrationCredentials({
        organizationId: state.organizationId,
        integrationId: integration.id,
        credentials: {
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token || "",
          expiresAt: String(Date.now() + (tokenJson.expires_in ?? 3600) * 1000),
        },
      });

      // Run immediate initial import of properties, user details, and bookings
      await syncHospitableTwoWay({
        organizationId: state.organizationId,
        integrationId: integration.id,
        userId: state.userId,
      }).catch(() => {});

      return NextResponse.redirect(`${appOrigin}/integrations?connected=hospitable`);
    }

    // Airbnb Partner OAuth callback
    if ((state.provider === "airbnb" || state.provider === "airbnb_ical") && code && process.env.AIRBNB_CLIENT_ID && process.env.AIRBNB_CLIENT_SECRET) {
      const tokenRes = await fetch("https://api.airbnb.com/v2/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.AIRBNB_CLIENT_ID,
          client_secret: process.env.AIRBNB_CLIENT_SECRET,
          redirect_uri: redirectUri,
          code,
        }),
      });

      if (!tokenRes.ok) {
        return NextResponse.redirect(
          `${appOrigin}/integrations?oauth_error=${encodeURIComponent("Airbnb token exchange failed.")}`,
        );
      }

      const tokenJson = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        user_id?: string | number;
      };

      const integration = await prisma.integration.create({
        data: {
          organizationId: state.organizationId,
          propertyId: state.propertyId || null,
          provider: "airbnb_ical",
          name: "Airbnb Host Account",
          status: "connected",
          config: { authMode: "oauth", airbnbUserId: tokenJson.user_id ? String(tokenJson.user_id) : undefined },
          lastSyncAt: new Date(),
        },
      });

      await saveIntegrationCredentials({
        organizationId: state.organizationId,
        integrationId: integration.id,
        credentials: {
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token || "",
        },
      });

      return NextResponse.redirect(`${appOrigin}/integrations?connected=airbnb`);
    }

    // Hospitable Connect channel callback (customer connected Airbnb / Booking.com via Hospitable Connect)
    if (process.env.HOSPITABLE_CONNECT_TOKEN) {
      const channelName = state.provider === "booking_com" ? "Booking.com (Hospitable Connect)" : "Airbnb (Hospitable Connect)";
      await prisma.integration.create({
        data: {
          organizationId: state.organizationId,
          propertyId: state.propertyId || null,
          provider: state.provider,
          name: channelName,
          status: "connected",
          config: { authMode: "hospitable_connect", customerId: state.organizationId },
          lastSyncAt: new Date(),
        },
      });

      await logActivity({
        organizationId: state.organizationId,
        userId: state.userId,
        source: "backend",
        category: "operations",
        action: "integration.channel_connected",
        summary: `Connected ${channelName} via Hospitable Connect channel sign-in.`,
      });

      return NextResponse.redirect(`${appOrigin}/integrations?connected=${encodeURIComponent(state.provider)}`);
    }

    return NextResponse.redirect(
      `${appOrigin}/integrations?oauth_error=${encodeURIComponent("Channel OAuth credentials are not configured.")}`,
    );
  } catch (error: unknown) {
    const msg = (error as Error).message ?? "OAuth callback failed";
    return NextResponse.redirect(`${appOrigin}/integrations?oauth_error=${encodeURIComponent(msg)}`);
  }
}
