import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, sessionCookieName, sessionMaxAgeSeconds, validateCredentials } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, password } = await req.json();

  if (!validateCredentials(String(user || ""), String(password || ""))) {
    return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(), await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  });
  return response;
}
