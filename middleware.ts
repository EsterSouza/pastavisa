import { NextRequest, NextResponse } from "next/server";
import { authCredentialsConfigured, sessionCookieName, validateCredentials, verifySessionToken } from "./lib/session-auth";

function decodeBasicAuth(auth?: string | null): { user: string; password: string } | null {
  if (!auth?.startsWith("Basic ")) return null;
  const [, encoded] = auth.split(" ");
  try {
    const decoded = atob(encoded || "");
    const separator = decoded.indexOf(":");
    return {
      user: separator >= 0 ? decoded.slice(0, separator) : "",
      password: separator >= 0 ? decoded.slice(separator + 1) : "",
    };
  } catch {
    return null;
  }
}

function unauthorized(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  if (!authCredentialsConfigured()) return NextResponse.next();

  const path = req.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const cookieToken = req.cookies.get(sessionCookieName())?.value;
  if (await verifySessionToken(cookieToken)) {
    return NextResponse.next();
  }

  const basic = decodeBasicAuth(req.headers.get("authorization"));
  if (basic && validateCredentials(basic.user, basic.password)) {
    return NextResponse.next();
  }

  return unauthorized(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
