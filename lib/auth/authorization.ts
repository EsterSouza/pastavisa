import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isOidcConfigured } from "./oidc";
import { ROLES, SESSION_COOKIE, readSession, type AppSession, type UserRole } from "./session";

export { ROLES, type UserRole };
export { isAdminOnlyPath, isPublicPath } from "./public-paths";

/** Papel da sessão (vem dos client roles do Keycloak, gravados na sessão no login). */
export function getUserRole(session: Pick<AppSession, "role"> | null | undefined): UserRole | null {
  const role = session?.role;
  return ROLES.find((allowed) => allowed === role) ?? null;
}

export function isAuthConfigured(): boolean {
  return isOidcConfigured();
}

export async function requireRole(allowed: readonly UserRole[] = ROLES) {
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const role = getUserRole(session);
  if (!role || !allowed.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export function requireAdmin() {
  return requireRole(["admin"]);
}
