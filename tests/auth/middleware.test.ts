import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { SESSION_COOKIE, signSession, type UserRole } from "@/lib/auth/session";
import { middleware } from "@/middleware";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";

async function request(path: string, role?: UserRole) {
  const req = new NextRequest(`https://pastavisa.test${path}`);
  if (role) req.cookies.set(SESSION_COOKIE, await signSession({ sub: "u1", role }));
  return req;
}

describe("auth middleware", () => {
  beforeEach(() => vi.stubEnv("SESSION_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("retorna 401 para API sem sessao", async () => {
    expect((await middleware(await request("/api/pastas"))).status).toBe(401);
  });

  it("manda para o login guardando o destino", async () => {
    const response = await middleware(await request("/pasta/123?tab=documentos"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Fpasta%2F123%3Ftab%3Ddocumentos");
  });

  it("recusa sessao forjada com outro segredo", async () => {
    const req = await request("/api/pastas", "admin");
    vi.stubEnv("SESSION_SECRET", "outro-segredo-qualquer-com-mais-de-32-chars");
    expect((await middleware(req)).status).toBe(401);
  });

  it("retorna 403 para operador em rota administrativa", async () => {
    expect((await middleware(await request("/api/templates", "operador"))).status).toBe(403);
  });

  it("permite pastas e correcao ao operador", async () => {
    expect((await middleware(await request("/api/pastas/123/uploads-corrigidos", "operador"))).status).toBe(200);
  });

  it("permite administracao ao admin", async () => {
    expect((await middleware(await request("/api/templates", "admin"))).status).toBe(200);
  });

  it("mantem o planner publico sem sessao", async () => {
    const page = await middleware(await request("/planner"));
    const analysis = await middleware(await request("/api/planejamento-comercial/analisar"));
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(analysis.status).toBe(200);
    expect(analysis.headers.get("cache-control")).toBe("no-store");
  });

  it("indisponivel sem SESSION_SECRET", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect((await middleware(await request("/api/pastas"))).status).toBe(503);
  });

  it("mantem os ativos de marca fora do middleware", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
    expect(source).toContain("brand/");
  });
});
