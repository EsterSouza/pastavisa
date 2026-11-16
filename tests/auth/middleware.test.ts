import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ updateSession: vi.fn() }));

vi.mock("@/lib/supabase/middleware", () => ({ updateSession: mocks.updateSession }));

import { middleware } from "@/middleware";

function request(path: string) {
  return new NextRequest(`https://pastavisa.test${path}`);
}

function session(role?: "admin" | "operador") {
  return {
    response: NextResponse.next(),
    user: role ? { app_metadata: { role } } : null,
  };
}

describe("auth middleware", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.updateSession.mockReset();
  });

  it("o endereço da Vercel redireciona para o domínio novo, menos o cron", async () => {
    const antigo = await middleware(new NextRequest("https://pastavisa.vercel.app/pasta/abc?x=1"));
    expect(antigo.status).toBe(308);
    expect(antigo.headers.get("location")).toBe("https://pastavisa.treinavisa.com.br/pasta/abc?x=1");
    mocks.updateSession.mockResolvedValue(session());
    const cron = await middleware(new NextRequest("https://pastavisa.vercel.app/api/cron/retencao-pastas"));
    expect(cron.status).not.toBe(308);
  });

  it("retorna 401 para API sem sessao", async () => {
    mocks.updateSession.mockResolvedValue(session());
    expect((await middleware(request("/api/pastas"))).status).toBe(401);
  });

  it("trata sessao expirada como nao autenticada", async () => {
    mocks.updateSession.mockResolvedValue(session());
    const response = await middleware(request("/pasta/123?tab=documentos"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Fpasta%2F123%3Ftab%3Ddocumentos");
  });

  it("retorna 403 para operador em rota administrativa", async () => {
    mocks.updateSession.mockResolvedValue(session("operador"));
    expect((await middleware(request("/api/templates"))).status).toBe(403);
  });

  it("permite pastas e correcao ao operador", async () => {
    mocks.updateSession.mockResolvedValue(session("operador"));
    expect((await middleware(request("/api/pastas/123/uploads-corrigidos"))).status).toBe(200);
  });

  it("mantem o planner publico sem consultar sessao", async () => {
    const page = await middleware(request("/planner"));
    const analysis = await middleware(request("/api/planejamento-comercial/analisar"));
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(analysis.status).toBe(200);
    expect(analysis.headers.get("cache-control")).toBe("no-store");
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("mantem os ativos de marca fora do middleware", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
    expect(source).toContain("brand/");
  });
});
