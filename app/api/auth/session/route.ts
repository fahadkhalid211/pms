import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { success: true, data: { user: null } },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  return NextResponse.json(
    {
      success: true,
      data: {
        user,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
