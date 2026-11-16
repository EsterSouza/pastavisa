import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { isRole, type UserRole } from "./session";

/**
 * Login pelo Keycloak (OIDC, authorization code + PKCE, client confidencial).
 *   OIDC_ISSUER         https://login.treinavisa.com.br/realms/treinavisa
 *   OIDC_CLIENT_ID      pastavisa
 *   OIDC_CLIENT_SECRET  segredo do client (cofre)
 *   APP_URL             https://pasta.treinavisa.com.br
 * O papel vem dos client roles do `pastavisa` no access token (`admin` ou `operador`).
 */

interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  appUrl: string;
}

export function isOidcConfigured(): boolean {
  return !!(
    process.env.OIDC_ISSUER &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET &&
    process.env.APP_URL &&
    (process.env.SESSION_SECRET || "").length >= 32
  );
}

export function oidcConfig(): OidcConfig {
  if (!isOidcConfigured()) throw new Error("Login (OIDC) não configurado");
  return {
    issuer: process.env.OIDC_ISSUER!.replace(/\/+$/, ""),
    clientId: process.env.OIDC_CLIENT_ID!,
    clientSecret: process.env.OIDC_CLIENT_SECRET!,
    appUrl: process.env.APP_URL!.replace(/\/+$/, ""),
  };
}

function endpoint(cfg: OidcConfig, name: "auth" | "token" | "logout" | "certs"): string {
  return `${cfg.issuer}/protocol/openid-connect/${name}`;
}

export function redirectUri(cfg = oidcConfig()): string {
  return `${cfg.appUrl}/api/auth/callback`;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function randomToken(size = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export async function authorizationUrl(state: string, verifier: string): Promise<string> {
  const cfg = oidcConfig();
  const url = new URL(endpoint(cfg, "auth"));
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", redirectUri(cfg));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", await pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface OidcIdentity {
  sub: string;
  email?: string;
  name?: string;
  roles: string[];
  idToken: string;
}

let jwksCache: { issuer: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;

function jwks(cfg: OidcConfig) {
  if (!jwksCache || jwksCache.issuer !== cfg.issuer) {
    jwksCache = { issuer: cfg.issuer, jwks: createRemoteJWKSet(new URL(endpoint(cfg, "certs"))) };
  }
  return jwksCache.jwks;
}

export async function exchangeCode(code: string, verifier: string): Promise<OidcIdentity> {
  const cfg = oidcConfig();
  const res = await fetch(endpoint(cfg, "token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(cfg),
      code_verifier: verifier,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Keycloak recusou o código (${res.status})`);
  const tokens = (await res.json()) as { access_token?: string; id_token?: string };
  if (!tokens.access_token || !tokens.id_token) throw new Error("Resposta do Keycloak sem tokens");

  const keys = jwks(cfg);
  const { payload: id } = await jwtVerify(tokens.id_token, keys, { issuer: cfg.issuer, audience: cfg.clientId });
  const { payload: access } = await jwtVerify(tokens.access_token, keys, { issuer: cfg.issuer });
  if (access.azp !== cfg.clientId || access.sub !== id.sub) throw new Error("Tokens do Keycloak não conferem");

  return {
    sub: id.sub!,
    email: typeof id.email === "string" ? id.email : undefined,
    name: typeof id.name === "string" ? id.name : undefined,
    roles: clientRoles(access, cfg.clientId),
    idToken: tokens.id_token,
  };
}

export function clientRoles(access: JWTPayload, clientId: string): string[] {
  const resourceAccess = access.resource_access as Record<string, { roles?: unknown }> | undefined;
  const roles = resourceAccess?.[clientId]?.roles;
  return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === "string") : [];
}

/** `admin` vence `operador`; sem nenhum dos dois, sem acesso. */
export function roleFromRoles(roles: string[]): UserRole | null {
  if (roles.includes("admin")) return "admin";
  const found = roles.find(isRole);
  return found ?? null;
}

export function logoutUrl(idToken?: string): string {
  const cfg = oidcConfig();
  const url = new URL(endpoint(cfg, "logout"));
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("post_logout_redirect_uri", `${cfg.appUrl}/login`);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  return url.toString();
}
