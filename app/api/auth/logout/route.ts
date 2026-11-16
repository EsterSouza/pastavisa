import { NextRequest, NextResponse } from "next/server";
import { isOidcConfigured, logoutUrl } from "@/lib/auth/oidc";
import { ID_TOKEN_COOKIE, OIDC_FLOW_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clear(response: NextResponse) {
  for (const name of [SESSION_COOKIE, ID_TOKEN_COOKIE, OIDC_FLOW_COOKIE]) response.cookies.delete(name);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function destination(req: NextRequest): string {
  if (!isOidcConfigured()) return new URL("/login", req.url).toString();
  return logoutUrl(req.cookies.get(ID_TOKEN_COOKIE)?.value);
}

/** Sai do app e também da sessão do Keycloak (senão o próximo "Entrar" volta logado). */
export async function GET(req: NextRequest) {
  return clear(NextResponse.redirect(destination(req)));
}

export async function POST(req: NextRequest) {
  return clear(NextResponse.json({ ok: true, logoutUrl: destination(req) }));
}
