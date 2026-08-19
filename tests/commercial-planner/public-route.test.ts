import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createCommercialPlan: vi.fn(),
  logPlannerRequest: vi.fn(),
  signPlan: vi.fn(),
}));

vi.mock("@/lib/commercial-planner/index.server", () => ({
  createCommercialPlan: mocks.createCommercialPlan,
}));
vi.mock("@/lib/commercial-planner/safe-logging", () => ({
  logPlannerRequest: mocks.logPlannerRequest,
}));
vi.mock("@/lib/commercial-planner/signed-plan", () => ({ signPlan: mocks.signPlan }));

import { POST } from "@/app/api/planejamento-comercial/analisar/route";
import {
  MAX_PLANNER_BODY_BYTES,
  MAX_PROCEDURES_BYTES,
} from "@/lib/commercial-planner/validation";

const plan = {
  procedimentos: ["Limpeza de pele"],
  documentos: [{ nome: "POP Limpeza de Pele", tipo: "POP" }],
  alertas: [],
  resumo: { totalProcedimentos: 1, totalDocumentos: 1, revisaoTecnicaObrigatoria: true as const },
  aviso: "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica." as const,
};

function request(body: string, contentType = "application/json") {
  return new NextRequest("https://pastavisa.test/api/planejamento-comercial/analisar", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

beforeEach(() => {
  mocks.createCommercialPlan.mockResolvedValue(plan);
  mocks.signPlan.mockReturnValue("signed-token");
});

afterEach(() => vi.clearAllMocks());

describe("public planning analysis route", () => {
  it("retorna plano, preco e token sem cache", async () => {
    const body = JSON.stringify({
      cliente: "Cliente A",
      procedimentos: "Limpeza de pele",
      equipamentos: [],
      formato: "digital",
      preco: { valorTotal: 1 },
    });
    const response = await POST(request(body));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(json).toMatchObject({ token: "signed-token", preco: { valorTotal: 597 } });
    expect(mocks.logPlannerRequest).toHaveBeenCalledWith({
      requestId: expect.any(String),
      durationMs: expect.any(Number),
      status: 200,
      quantities: { payloadBytes: expect.any(Number), procedureBytes: 15, procedures: 1, documents: 1 },
    });
    expect(JSON.stringify(mocks.logPlannerRequest.mock.calls)).not.toContain("Cliente A");
  });

  it("assina o token sem a ressalva de legislação, que fica só na tela", async () => {
    // É o token que alimenta o PDF: o que não entra nele não tem como chegar ao
    // cliente por descuido de redação mais adiante.
    const reservado = "PMMA não pode ser usado para fins estéticos.";
    mocks.createCommercialPlan.mockResolvedValue({
      ...plan,
      alertas: ["Confirme qual tipo de peeling é realizado.", reservado],
      alertasReservados: [reservado],
    });

    const response = await POST(
      request(
        JSON.stringify({
          cliente: "Cliente A",
          procedimentos: "peeling e pmma",
          equipamentos: [],
          formato: "digital",
        })
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.alertas).toContain(reservado);
    expect(mocks.signPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        plano: expect.objectContaining({ alertas: ["Confirme qual tipo de peeling é realizado."] }),
      })
    );
  });

  it("retorna 400 para JSON invalido, tipo incorreto e corpo acima de 12 KB", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request("{}", "text/plain"))).status).toBe(400);
    const oversized = JSON.stringify({ padding: "x".repeat(MAX_PLANNER_BODY_BYTES) });
    expect((await POST(request(oversized))).status).toBe(400);
  });

  it("retorna 422 para procedimentos acima de 8 KB ou formato invalido", async () => {
    const procedures = "x".repeat(MAX_PROCEDURES_BYTES + 1);
    expect((await POST(request(JSON.stringify({ cliente: "A", procedimentos: procedures, formato: "digital" })))).status).toBe(422);
    expect((await POST(request(JSON.stringify({ cliente: "A", procedimentos: "Técnica", formato: "forjado" })))).status).toBe(422);
  });

  it("retorna 503 sem expor erro interno", async () => {
    mocks.createCommercialPlan.mockRejectedValue(new Error("DATABASE_URL=private"));
    const response = await POST(request(JSON.stringify({
      cliente: "A",
      procedimentos: "Técnica",
      formato: "digital",
    })));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("DATABASE_URL");
  });

  it("nao importa persistencia nem expoe outros metodos", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/api/planejamento-comercial/analisar/route.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/@\/lib\/(prisma|file-storage|supabase)/);
    expect(source).not.toMatch(/service.?role/i);
    expect(source.match(/export async function (GET|PUT|PATCH|DELETE)/g)).toBeNull();
  });
});
