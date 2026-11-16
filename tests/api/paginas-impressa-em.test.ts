import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn(), pasta: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contagemPaginas: { findUnique: mocks.findUnique, update: mocks.update, upsert: mocks.upsert },
    pasta: { findUnique: mocks.pasta },
  },
}));

import { PATCH, POST } from "@/app/api/pastas/[id]/paginas/route";

const pedido = (metodo: string, corpo: unknown) =>
  new NextRequest("http://x/api/pastas/p1/paginas", { method: metodo, body: JSON.stringify(corpo) });
const params = { params: { id: "p1" } };

describe("data de impressão da contagem", () => {
  beforeEach(() => vi.resetAllMocks());

  it("grava o dia escolhido ao meio-dia de Brasília", async () => {
    mocks.findUnique.mockResolvedValue({ id: "c1" });
    mocks.update.mockImplementation(async ({ data }) => ({ id: "c1", ...data }));
    const res = await PATCH(pedido("PATCH", { impressaEm: "2026-08-28" }), params);
    expect(res.status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data.contadaEm.toISOString()).toBe("2026-08-28T15:00:00.000Z");
  });

  it("recusa data inválida ou no futuro", async () => {
    expect((await PATCH(pedido("PATCH", { impressaEm: "28/08/2026" }), params)).status).toBe(400);
    expect((await PATCH(pedido("PATCH", { impressaEm: "2099-01-01" }), params)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("contar de novo não muda o dia da impressão", async () => {
    mocks.pasta.mockResolvedValue({ clienteNomeFantasia: "X", clienteRtNome: null, versaoPasta: "Digital" });
    mocks.upsert.mockResolvedValue({});
    await POST(pedido("POST", { documentos: [{ nome: "MBP", paginas: 10 }] }), params);
    const { create, update } = mocks.upsert.mock.calls[0][0];
    expect(create.contadaEm).toBeInstanceOf(Date);
    expect(update.contadaEm).toBeUndefined();
  });
});
