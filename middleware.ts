import { NextRequest, NextResponse } from "next/server";
import {
  getUserRole,
  isAdminOnlyPath,
  isPublicPath,
  isSupabaseAuthConfigured,
} from "./lib/auth/authorization";
import { updateSession } from "./lib/supabase/middleware";

function unauthorized(req: NextRequest, sessionResponse?: NextResponse) {
  let response: NextResponse;
  if (req.nextUrl.pathname.startsWith("/api/")) {
    response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
  } else {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    response = NextResponse.redirect(loginUrl);
  }

  sessionResponse?.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (isPublicPath(path)) return NextResponse.next();

  if (!isSupabaseAuthConfigured()) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Application authentication is not configured" }, { status: 503 });
    }
    return new NextResponse("Aplicacao temporariamente indisponivel.", { status: 503 });
  }

  const { response, user } = await updateSession(req);
  if (!user) return unauthorized(req, response);

  const role = getUserRole(user);
  if (!role || (isAdminOnlyPath(path) && role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
