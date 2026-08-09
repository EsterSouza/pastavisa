import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const ROLES = ["admin", "operador"] as const;
export type UserRole = (typeof ROLES)[number];

const ADMIN_PREFIXES = ["/templates", "/legislacoes", "/api/templates", "/api/legislacoes"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getUserRole(user: Pick<User, "app_metadata"> | null | undefined): UserRole | null {
  const role = user?.app_metadata?.role;
  return ROLES.find((allowed) => allowed === role) ?? null;
}

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    matchesPrefix(pathname, "/api/auth") ||
    pathname === "/api/health" ||
    matchesPrefix(pathname, "/planner") ||
    pathname === "/api/planejamento-comercial/analisar" ||
    pathname === "/api/planejamento-comercial/pdf"
  );
}

export function isSupabaseAuthConfigured(): boolean {
  return !!(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY)
  );
}

export async function requireRole(allowed: readonly UserRole[] = ROLES) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const role = getUserRole(data.user);
  if (!role || !allowed.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export function requireAdmin() {
  return requireRole(["admin"]);
}
