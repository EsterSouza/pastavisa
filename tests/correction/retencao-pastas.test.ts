import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), excluirPasta: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { pasta: { findMany: mocks.findMany } } }));
vi.mock("@/lib/pasta-exclusao", () => ({ excluirPasta: mocks.excluirPasta }));

import { GET } from "@/app/api/cron/retencao-pastas/route";

function pedido(authorization?: string) {
  return new NextRequest("http://localhost/api/cron/retencao-pastas", {
    headers: authorization ? { authorization } : {},
  });
}

describe("retenção das pastas concluídas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "segredo";
    mocks.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    mocks.excluirPasta.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CRON_SECRET;
  });

  it("recusa chamada sem o segredo e não apaga nada", async () => {
    expect((await GET(pedido())).status).toBe(401);
    expect((await GET(pedido("Bearer outro"))).status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("fica fechada quando o segredo não está configurado", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(pedido("Bearer undefined"))).status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("exclui só pasta concluída há 30 dias ou mais", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));

    const resposta = await GET(pedido("Bearer segredo"));

    expect(resposta.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: "concluida", concluidaEm: { lte: new Date("2026-09-20T09:00:00Z") } },
      select: { id: true },
    });
    expect(mocks.excluirPasta.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
  });

  it("segue para as próximas quando uma exclusão falha", async () => {
    mocks.excluirPasta.mockRejectedValueOnce(new Error("Storage fora do ar"));

    const resposta = await GET(pedido("Bearer segredo"));

    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toEqual({
      excluidas: ["b"],
      falhas: [{ id: "a", erro: "Storage fora do ar" }],
    });
  });
});
