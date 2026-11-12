import { SignJWT, jwtVerify } from "jose";

/**
 * Sessão do app depois do login no Keycloak: um JWT assinado pelo próprio app (HS256,
 * SESSION_SECRET) num cookie httpOnly. Roda no middleware (Edge) e nas rotas (Node).
 * O Keycloak continua sendo a fonte da identidade e do papel; a sessão só guarda o
 * resultado da verificação dos tokens dele por algumas horas.
 */

export const SESSION_COOKIE = "pv_session";
export const ID_TOKEN_COOKIE = "pv_idt";
export const OIDC_FLOW_COOKIE = "pv_oidc";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const FLOW_TTL_SECONDS = 10 * 60;
const ISSUER = "pastavisa";

export const ROLES = ["admin", "operador"] as const;
export type UserRole = (typeof ROLES)[number];

export interface AppSession {
  sub: string;
  role: UserRole;
  email?: string;
  name?: string;
}

export interface OidcFlow {
  state: string;
  verifier: string;
  next: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres)");
  return new TextEncoder().encode(secret);
}

export function isRole(value: unknown): value is UserRole {
  return ROLES.some((role) => role === value);
}

export async function signSession(session: AppSession, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  return new SignJWT({ role: session.role, email: session.email, name: session.name, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

export async function readSession(token?: string | null): Promise<AppSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], issuer: ISSUER });
    if (payload.typ !== "session" || !payload.sub || !isRole(payload.role)) return null;
    return {
      sub: payload.sub,
      role: payload.role,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

export async function signFlow(flow: OidcFlow): Promise<string> {
  return new SignJWT({ ...flow, typ: "oidc-flow" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${FLOW_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function readFlow(token?: string | null): Promise<OidcFlow | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], issuer: ISSUER });
    if (payload.typ !== "oidc-flow") return null;
    const { state, verifier, next } = payload as Record<string, unknown>;
    if (typeof state !== "string" || typeof verifier !== "string" || typeof next !== "string") return null;
    return { state, verifier, next };
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
