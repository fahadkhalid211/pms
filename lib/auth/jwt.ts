import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

function getSecret() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export interface SessionTokenPayload {
  sub: string;
  email: string;
  name: string;
  organizationId: string | null;
  roleKey: string | null;
  propertyIds: string[];
  permissions: string[];
}

export async function signSessionToken(
  payload: SessionTokenPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionTokenPayload | null> {
  try {
    const { payload: decoded } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (!decoded.sub) return null;
    return {
      sub: decoded.sub,
      email: (decoded.email as string) ?? "",
      name: (decoded.name as string) ?? "",
      organizationId: (decoded.organizationId as string) ?? null,
      roleKey: (decoded.roleKey as string) ?? null,
      propertyIds: Array.isArray(decoded.propertyIds) ? (decoded.propertyIds as string[]) : [],
      permissions: Array.isArray(decoded.permissions) ? (decoded.permissions as string[]) : [],
    };
  } catch {
    return null;
  }
}
