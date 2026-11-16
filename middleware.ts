import { NextRequest, NextResponse } from "next/server";
import { isAdminOnlyPath, isPublicPath } from "./lib/auth/public-paths";
import { SESSION_COOKIE, readSession } from "./lib/auth/session";

function unauthorized(req: NextRequest) {
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

  return response;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (isPublicPath(path)) {
    const response = NextResponse.next();
    if (path === "/planner" || path.startsWith("/planner/") || path.startsWith("/api/planejamento-comercial/")) {
      response.headers.set("Cache-Control", "no-store");
    }
    return response;
  }

  // Middleware roda no Edge: confere só o segredo da sessão (o resto do OIDC é das rotas Node).
  if ((process.env.SESSION_SECRET || "").length < 32) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Application authentication is not configured" }, { status: 503 });
    }
    return new NextResponse("Aplicacao temporariamente indisponivel.", { status: 503 });
  }

  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return unauthorized(req);

  if (isAdminOnlyPath(path) && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|favicon.ico).*)"],
};
