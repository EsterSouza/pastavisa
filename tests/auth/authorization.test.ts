import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => (mocks.token ? { value: mocks.token } : undefined) }),
}));

import { getUserRole, isAdminOnlyPath, isPublicPath, requireAdmin } from "@/lib/auth/authorization";
import { signSession } from "@/lib/auth/session";
import { clientRoles, roleFromRoles } from "@/lib/auth/oidc";

beforeEach(() => vi.stubEnv("SESSION_SECRET", "segredo-de-teste-com-mais-de-32-caracteres"));
afterEach(() => {
  vi.unstubAllEnvs();
  mocks.token = undefined;
});

describe("authorization", () => {
  it("aceita apenas os papeis do app", () => {
    expect(getUserRole({ role: "admin" })).toBe("admin");
    expect(getUserRole({ role: "operador" })).toBe("operador");
    expect(getUserRole({ role: "outro" as never })).toBeNull();
    expect(getUserRole(null)).toBeNull();
  });

  it("le o papel dos client roles do Keycloak, admin vence", () => {
    const access = { resource_access: { pastavisa: { roles: ["operador", "admin"] }, outro: { roles: ["admin"] } } };
    expect(clientRoles(access, "pastavisa")).toEqual(["operador", "admin"]);
    expect(roleFromRoles(clientRoles(access, "pastavisa"))).toBe("admin");
    expect(roleFromRoles(["operador"])).toBe("operador");
    expect(roleFromRoles(clientRoles(access, "personalizador"))).toBeNull();
    expect(roleFromRoles(["uma_authorization"])).toBeNull();
  });

  it("mantem planner e autenticacao publicos, mas nao administracao", () => {
    expect(isPublicPath("/planner/novo")).toBe(true);
    expect(isPublicPath("/api/planejamento-comercial/analisar")).toBe(true);
    expect(isPublicPath("/api/planejamento-comercial/pdf")).toBe(true);
    expect(isPublicPath("/api/planejamento-comercial/interno")).toBe(false);
    expect(isPublicPath("/api/planner/analisar")).toBe(false);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/callback")).toBe(true);
    expect(isPublicPath("/api/pastas")).toBe(false);
    expect(isPublicPath("/api/cron/retencao-pastas")).toBe(true);
    expect(isPublicPath("/api/cronometro")).toBe(false);
    expect(isAdminOnlyPath("/api/templates/123")).toBe(true);
    expect(isAdminOnlyPath("/legislacoes")).toBe(true);
    expect(isAdminOnlyPath("/api/pastas")).toBe(false);
  });

  it("retorna 401 sem sessao", async () => {
    expect((await requireAdmin())?.status).toBe(401);
  });

  it("retorna 401 com sessao expirada", async () => {
    mocks.token = await signSession({ sub: "u1", role: "admin" }, -10);
    expect((await requireAdmin())?.status).toBe(401);
  });

  it("retorna 403 para operador em acao administrativa", async () => {
    mocks.token = await signSession({ sub: "u1", role: "operador" });
    expect((await requireAdmin())?.status).toBe(403);
  });

  it("autoriza admin", async () => {
    mocks.token = await signSession({ sub: "u1", role: "admin" });
    expect(await requireAdmin()).toBeNull();
  });
});
