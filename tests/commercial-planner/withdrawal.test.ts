import { describe, expect, it } from "vitest";
import { calculatePlannerPrice } from "@/lib/commercial-planner/pricing";
import { applyWithdrawal } from "@/lib/commercial-planner/withdrawal";
import type { PublicCommercialPlan } from "@/lib/commercial-planner/types";

function plan(overrides: Partial<PublicCommercialPlan> = {}): PublicCommercialPlan {
  return {
    procedimentos: ["Limpeza de pele", "Microagulhamento", "Peeling químico"],
    documentos: [
      { nome: "POP - Limpeza de pele", tipo: "POP" },
      { nome: "POP - Microagulhamento", tipo: "POP" },
      { nome: "TCLE - Procedimentos estéticos faciais", tipo: "TCLE" },
      { nome: "Manual de Boas Práticas", tipo: "MBP" },
    ],
    vinculos: [
      { documento: "POP - Limpeza de pele", tipo: "POP", procedimentos: ["Limpeza de pele"] },
      { documento: "POP - Microagulhamento", tipo: "POP", procedimentos: ["Microagulhamento"] },
      {
        documento: "TCLE - Procedimentos estéticos faciais",
        tipo: "TCLE",
        procedimentos: ["Limpeza de pele", "Microagulhamento", "Peeling químico"],
      },
      { documento: "Manual de Boas Práticas", tipo: "MBP", procedimentos: [] },
    ],
    alertas: [],
    alertasReservados: [],
    resumo: { totalProcedimentos: 3, totalDocumentos: 4, revisaoTecnicaObrigatoria: true },
    aviso: "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.",
    ...overrides,
  };
}

describe("retirada de procedimentos", () => {
  it("sem retirada mantém o plano inteiro", () => {
    const resultado = applyWithdrawal(plan(), []);
    expect(resultado.totalProcedimentos).toBe(3);
    expect(resultado.totalDocumentos).toBe(4);
    expect(resultado.retirados).toEqual([]);
  });

  it("derruba o documento exclusivo e preserva o compartilhado e o geral", () => {
    const resultado = applyWithdrawal(plan(), ["Microagulhamento"]);

    expect(resultado.incluidos).toEqual(["Limpeza de pele", "Peeling químico"]);
    expect(resultado.retirados).toEqual(["Microagulhamento"]);
    expect(resultado.documentos.map((documento) => documento.nome)).toEqual([
      "POP - Limpeza de pele",
      "TCLE - Procedimentos estéticos faciais",
      "Manual de Boas Práticas",
    ]);
    expect(resultado.totalDocumentos).toBe(3);
  });

  it("mantém o documento geral mesmo quando todos os procedimentos saem", () => {
    const resultado = applyWithdrawal(plan(), ["Limpeza de pele", "Microagulhamento", "Peeling químico"]);

    expect(resultado.totalProcedimentos).toBe(0);
    expect(resultado.documentos.map((documento) => documento.nome)).toEqual(["Manual de Boas Práticas"]);
  });

  it("ignora acento, caixa e nome que não está no plano", () => {
    const resultado = applyWithdrawal(plan(), ["  MICROAGULHAMENTO ", "Procedimento inexistente"]);

    expect(resultado.retirados).toEqual(["Microagulhamento"]);
    expect(resultado.incluidos).toEqual(["Limpeza de pele", "Peeling químico"]);
  });

  it("101 procedimentos custam adicional e 100 não; a retirada devolve o valor base", () => {
    const cento_e_um = plan({
      procedimentos: Array.from({ length: 101 }, (_, index) => `Técnica ${index + 1}`),
      vinculos: [],
      documentos: [],
    });

    const cheio = applyWithdrawal(cento_e_um, []);
    const reduzido = applyWithdrawal(cento_e_um, ["Técnica 101"]);

    expect(cheio.totalProcedimentos).toBe(101);
    expect(calculatePlannerPrice(cheio.totalProcedimentos, "digital")).toMatchObject({
      valorBase: 597,
      valorAdicional: 100,
      valorTotal: 697,
    });
    expect(reduzido.totalProcedimentos).toBe(100);
    expect(calculatePlannerPrice(reduzido.totalProcedimentos, "digital")).toMatchObject({
      valorAdicional: 0,
      valorTotal: 597,
    });
  });
});
