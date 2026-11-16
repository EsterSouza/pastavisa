import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { authorizationUrl, isOidcConfigured, randomToken } from "@/lib/auth/oidc";
import { OIDC_FLOW_COOKIE, cookieOptions, signFlow } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Começa o login: manda para o Keycloak com state e PKCE guardados num cookie de 10 min. */
export async function GET(req: NextRequest) {
  if (!isOidcConfigured()) {
    return NextResponse.json({ error: "Authentication unavailable" }, { status: 503 });
  }

  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const state = randomToken();
  const verifier = randomToken(48);

  const response = NextResponse.redirect(await authorizationUrl(state, verifier));
  response.cookies.set(OIDC_FLOW_COOKIE, await signFlow({ state, verifier, next }), cookieOptions(10 * 60));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** O login por senha direto no app acabou: quem chamar recebe para onde ir. */
export async function POST() {
  return NextResponse.json({ error: "Use o login pelo Keycloak", login: "/api/auth/login" }, { status: 410 });
}
