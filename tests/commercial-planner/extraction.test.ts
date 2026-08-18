import { describe, expect, it, vi } from "vitest";
import { extractExplicitTechniques } from "@/lib/commercial-planner/extraction";
import type { CommercialPlannerInput, PlannerAnalysis } from "@/lib/commercial-planner/types";

/**
 * A extração é a fronteira entre o que a análise devolve e o que entra no plano.
 * O que se prova aqui: fora do escopo não vira técnica, e alerta já escrito não é
 * repetido em outras palavras.
 */

function pedido(procedimentos: string): CommercialPlannerInput {
  return { cliente: "Clínica", procedimentos, equipamentos: [] };
}

function analisador(analise: Partial<PlannerAnalysis>) {
  return vi.fn().mockResolvedValue({
    data: { mentions: [], coverages: [], restrictions: [], alerts: [], ...analise },
    tokensUsed: 0,
  });
}

function mencao(name: string, kind: string, canonicalName = name) {
  return { name, canonicalName, evidence: name, kind, explicit: true };
}

describe("extração das técnicas declaradas", () => {
  it("não deixa atividade fora do escopo virar técnica, mesmo se a análise insistir", async () => {
    const resultado = await extractExplicitTechniques(
      pedido("limpeza de pele e lipoaspiracao"),
      [],
      analisador({
        mentions: [
          mencao("limpeza de pele", "procedure", "Limpeza de Pele"),
          mencao("lipoaspiracao", "procedure", "Lipoaspiração"),
        ],
      })
    );

    expect(resultado.techniques.map((item) => item.name)).toEqual(["Limpeza de Pele"]);
    expect(resultado.alerts.some((alerta) => /não é atendida por esta pasta/.test(alerta))).toBe(true);
  });

  it("não pede confirmação de item fora do escopo", async () => {
    const resultado = await extractExplicitTechniques(
      pedido("clareamento dental"),
      [],
      analisador({ mentions: [mencao("clareamento dental", "uncertain")] })
    );

    expect(resultado.alerts.some((alerta) => /Confirme se/.test(alerta))).toBe(false);
  });

  it("não repete em outras palavras a dúvida que a análise já escreveu", async () => {
    const resultado = await extractExplicitTechniques(
      pedido("Detox Turbo"),
      [],
      analisador({
        mentions: [mencao("Detox Turbo", "uncertain")],
        alerts: ["Detox Turbo é nome comercial da casa: informe quais técnicas o compõem."],
      })
    );

    expect(resultado.alerts.filter((alerta) => /Detox Turbo/.test(alerta))).toHaveLength(1);
  });

  it("pede confirmação quando a análise deixou o termo em silêncio", async () => {
    const resultado = await extractExplicitTechniques(
      pedido("micro"),
      [],
      analisador({ mentions: [mencao("micro", "uncertain")] })
    );

    expect(resultado.alerts.some((alerta) => /Confirme se “micro”/.test(alerta))).toBe(true);
  });
});
