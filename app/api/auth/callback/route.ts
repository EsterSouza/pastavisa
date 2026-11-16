import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, roleFromRoles } from "@/lib/auth/oidc";
import {
  ID_TOKEN_COOKIE,
  OIDC_FLOW_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  cookieOptions,
  readFlow,
  signSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backToLogin(req: NextRequest, motivo: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("erro", motivo);
  const response = NextResponse.redirect(url);
  response.cookies.delete(OIDC_FLOW_COOKIE);
  return response;
}

/** Volta do Keycloak: confere o state, troca o código, verifica os tokens e abre a sessão. */
export async function GET(req: NextRequest) {
  const flow = await readFlow(req.cookies.get(OIDC_FLOW_COOKIE)?.value);
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return backToLogin(req, "cancelado");
  if (!flow || !params.get("code") || params.get("state") !== flow.state) return backToLogin(req, "expirado");

  try {
    const identity = await exchangeCode(params.get("code")!, flow.verifier);
    const role = roleFromRoles(identity.roles);
    if (!role) return backToLogin(req, "sem-acesso");

    const response = NextResponse.redirect(new URL(flow.next, req.url));
    response.cookies.set(
      SESSION_COOKIE,
      await signSession({ sub: identity.sub, role, email: identity.email, name: identity.name }),
      cookieOptions(SESSION_TTL_SECONDS)
    );
    response.cookies.set(ID_TOKEN_COOKIE, identity.idToken, cookieOptions(SESSION_TTL_SECONDS));
    response.cookies.delete(OIDC_FLOW_COOKIE);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return backToLogin(req, "falhou");
  }
}
