import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ logPlannerRequest: vi.fn() }));
vi.mock("@/lib/commercial-planner/safe-logging", () => ({ logPlannerRequest: mocks.logPlannerRequest }));

process.env.PLANNER_SIGNING_SECRET = "segredo-de-teste-pv009";

import { POST } from "@/app/api/planejamento-comercial/pdf/route";
import { extractPdfTextFromBuffer } from "@/lib/extractor";
import { PLAN_TOKEN_TTL_SECONDS, signPlan } from "@/lib/commercial-planner/signed-plan";
import type { PublicCommercialPlan } from "@/lib/commercial-planner/types";

const plano: PublicCommercialPlan = {
  procedimentos: ["Limpeza de pele", "Microagulhamento"],
  documentos: [
    { nome: "POP - Limpeza de pele", tipo: "POP" },
    { nome: "POP - Microagulhamento", tipo: "POP" },
    { nome: "Manual de Boas Práticas", tipo: "MBP" },
  ],
  vinculos: [
    { documento: "POP - Limpeza de pele", tipo: "POP", procedimentos: ["Limpeza de pele"] },
    { documento: "POP - Microagulhamento", tipo: "POP", procedimentos: ["Microagulhamento"] },
    { documento: "Manual de Boas Práticas", tipo: "MBP", procedimentos: [] },
  ],
  alertas: [],
  resumo: { totalProcedimentos: 2, totalDocumentos: 3, revisaoTecnicaObrigatoria: true },
  aviso: "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.",
};

function token(overrides: Partial<PublicCommercialPlan> = {}, now?: number) {
  return signPlan(
    {
      cliente: "Clínica Aurora",
      municipio: "Belo Horizonte",
      uf: "MG",
      plano: { ...plano, ...overrides },
      preco: { formato: "digital", valorBase: 597, valorAdicional: 0, valorTotal: 597, moeda: "BRL" },
      prazo: { diasUteis: 15, sujeitoConfirmacaoTecnica: false },
    },
    now === undefined ? {} : { now }
  );
}

function request(body: unknown, contentType = "application/json") {
  return new NextRequest("https://pastavisa.test/api/planejamento-comercial/pdf", {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function pdfText(response: Response) {
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, conteudo: (await extractPdfTextFromBuffer(buffer)).replace(/\s+/g, " ") };
}

const muitos = Array.from({ length: 101 }, (_, index) => `Técnica ${index + 1}`);

afterEach(() => vi.clearAllMocks());

describe("rota pública de PDF do planejamento", () => {
  it("devolve um PDF anexado, sem cache e sem registrar o cliente", async () => {
    const response = await POST(request({ token: token(), formato: "colorida", retirados: [] }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="pre-planejamento-clinica-aurora.pdf"'
    );

    const { buffer, conteudo } = await pdfText(response);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(conteudo).toContain("Clínica Aurora");
    expect(conteudo).toContain("PRÉ-PLANEJAMENTO PROVISÓRIO");
    expect(JSON.stringify(mocks.logPlannerRequest.mock.calls)).not.toContain("Clínica Aurora");
    expect(mocks.logPlannerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: 200, quantities: expect.objectContaining({ procedures: 2, documents: 3 }) })
    );
  });

  it("recalcula preço no servidor e ignora o valor enviado pelo navegador", async () => {
    const response = await POST(
      request({ token: token(), formato: "colorida", retirados: [], preco: { valorTotal: 1 } })
    );
    const { conteudo } = await pdfText(response);

    expect(conteudo).toContain("R$ 957,00");
    expect(conteudo).not.toContain("R$ 1,00");
  });

  it("a retirada de 101 para 100 procedimentos derruba o adicional", async () => {
    const cheio = await pdfText(
      await POST(request({ token: token({ procedimentos: muitos, vinculos: [] }), formato: "digital", retirados: [] }))
    );
    const reduzido = await pdfText(
      await POST(
        request({
          token: token({ procedimentos: muitos, vinculos: [] }),
          formato: "digital",
          retirados: ["Técnica 101"],
        })
      )
    );

    expect(cheio.conteudo).toContain("R$ 697,00");
    expect(cheio.conteudo).toContain("sujeito à confirmação técnica");
    expect(reduzido.conteudo).toContain("R$ 597,00");
    expect(reduzido.conteudo).not.toContain("R$ 697,00");
    expect(reduzido.conteudo).not.toContain("sujeito à confirmação técnica");
  });

  it("recusa token alterado, expirado, ausente e formato inválido", async () => {
    const valido = token();
    const alterado = `${valido.slice(0, -4)}0000`;
    const expirado = token({}, Math.floor(Date.now() / 1000) - PLAN_TOKEN_TTL_SECONDS - 60);

    for (const body of [
      { token: alterado, formato: "digital" },
      { token: expirado, formato: "digital" },
      { formato: "digital" },
      { token: valido, formato: "forjado" },
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(422);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("recusa retirada total, corpo inválido e corpo acima de 12 KB", async () => {
    const total = await POST(
      request({ token: token(), formato: "digital", retirados: ["Limpeza de pele", "Microagulhamento"] })
    );
    expect(total.status).toBe(422);

    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request({ token: token(), formato: "digital" }, "text/plain"))).status).toBe(400);
    expect((await POST(request({ token: token(), padding: "x".repeat(12 * 1024) }))).status).toBe(400);
  });

  it("não importa persistência nem expõe outros métodos", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/api/planejamento-comercial/pdf/route.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/@\/lib\/(prisma|file-storage|supabase)/);
    expect(source).not.toMatch(/service.?role/i);
    expect(source.match(/export async function (GET|PUT|PATCH|DELETE)/g)).toBeNull();
  });
});
