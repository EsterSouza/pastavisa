import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));

import {
  getUserRole,
  isAdminOnlyPath,
  isPublicPath,
  requireAdmin,
} from "@/lib/auth/authorization";

afterEach(() => mocks.getUser.mockReset());

describe("authorization", () => {
  it("aceita apenas papeis vindos de app_metadata", () => {
    expect(getUserRole({ app_metadata: { role: "admin" } })).toBe("admin");
    expect(getUserRole({ app_metadata: { role: "operador" } })).toBe("operador");
    expect(getUserRole({ app_metadata: { role: "outro" } })).toBeNull();
  });

  it("mantem planner e autenticacao publicos, mas nao administracao", () => {
    expect(isPublicPath("/planner/novo")).toBe(true);
    expect(isPublicPath("/api/planejamento-comercial/analisar")).toBe(true);
    expect(isPublicPath("/api/planejamento-comercial/pdf")).toBe(true);
    expect(isPublicPath("/api/planejamento-comercial/interno")).toBe(false);
    expect(isPublicPath("/api/planner/analisar")).toBe(false);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/pastas")).toBe(false);
    expect(isAdminOnlyPath("/api/templates/123")).toBe(true);
    expect(isAdminOnlyPath("/legislacoes")).toBe(true);
    expect(isAdminOnlyPath("/api/pastas")).toBe(false);
  });

  it("retorna 401 sem usuario confirmado", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    expect((await requireAdmin())?.status).toBe(401);
  });

  it("retorna 403 para operador em acao administrativa", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "operador" } } }, error: null });
    expect((await requireAdmin())?.status).toBe(403);
  });

  it("autoriza admin", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "admin" } } }, error: null });
    expect(await requireAdmin()).toBeNull();
  });
});
