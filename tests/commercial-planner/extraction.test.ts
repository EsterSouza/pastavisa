import { describe, expect, it, vi } from "vitest";
import { extractExplicitTechniques } from "@/lib/commercial-planner/extraction";
import type { CommercialPlannerInput, PlannerAnalyzer } from "@/lib/commercial-planner/types";

function input(procedimentos: string): CommercialPlannerInput {
  return { cliente: "Cliente atual", procedimentos, equipamentos: [] };
}

function analyzer(data: unknown): PlannerAnalyzer {
  return vi.fn().mockResolvedValue({ data, tokensUsed: 10 });
}

describe("extração prudente de procedimentos", () => {
  it("não transforma produto, marca, ativo, indicação ou equipamento em procedimento", async () => {
    const result = await extractExplicitTechniques(
      input("Sculptra, ácido hialurônico para rejuvenescimento, Lavieen e microagulhamento facial."),
      [],
      analyzer({
        mentions: [
          { name: "Sculptra", canonicalName: "Sculptra", evidence: "Sculptra", kind: "brand", explicit: true },
          { name: "ácido hialurônico", canonicalName: "Ácido hialurônico", evidence: "ácido hialurônico", kind: "active", explicit: true },
          { name: "rejuvenescimento", canonicalName: "Rejuvenescimento", evidence: "rejuvenescimento", kind: "indication", explicit: true },
          { name: "Lavieen", canonicalName: "Lavieen", evidence: "Lavieen", kind: "equipment", explicit: true },
          { name: "microagulhamento facial", canonicalName: "Microagulhamento", evidence: "microagulhamento facial", kind: "procedure", explicit: true },
        ],
        coverages: [],
        alerts: [],
      })
    );

    expect(result.techniques.map((item) => item.name)).toEqual(["Microagulhamento"]);
  });

  it("consolida sinônimos e duplicatas somente pelo nome técnico canônico", async () => {
    const result = await extractExplicitTechniques(
      input("Drenagem linfática; drenagem pós-operatória; drenagem linfática."),
      [],
      analyzer({
        mentions: [
          { name: "Drenagem linfática", canonicalName: "Drenagem Linfática", evidence: "Drenagem linfática", kind: "procedure", explicit: true },
          { name: "drenagem pós-operatória", canonicalName: "Drenagem Linfática", evidence: "drenagem pós-operatória", kind: "procedure", explicit: true },
          { name: "drenagem linfática", canonicalName: "Drenagem Linfática", evidence: "drenagem linfática", kind: "procedure", explicit: true },
        ],
        coverages: [],
        alerts: [],
      })
    );

    expect(result.techniques).toEqual([
      {
        name: "Drenagem Linfática",
        evidence: ["Drenagem linfática", "drenagem pós-operatória", "drenagem linfática"],
      },
    ]);
  });

  it("mantém técnicas parecidas materialmente distintas", async () => {
    const result = await extractExplicitTechniques(
      input("Microagulhamento e intradermoterapia pressurizada."),
      [],
      analyzer({
        mentions: [
          { name: "Microagulhamento", canonicalName: "Microagulhamento", evidence: "Microagulhamento", kind: "procedure", explicit: true },
          { name: "intradermoterapia pressurizada", canonicalName: "Intradermoterapia Pressurizada", evidence: "intradermoterapia pressurizada", kind: "procedure", explicit: true },
        ],
        coverages: [],
        alerts: [],
      })
    );

    expect(result.techniques.map((item) => item.name)).toEqual([
      "Microagulhamento",
      "Intradermoterapia Pressurizada",
    ]);
  });

  it("não aceita técnica inferida sem evidência literal e transforma dúvida em alerta", async () => {
    const result = await extractExplicitTechniques(
      input("Protocolo para manchas."),
      [],
      analyzer({
        mentions: [
          { name: "Laser", canonicalName: "Laser", evidence: "laser", kind: "procedure", explicit: true },
          { name: "protocolo para manchas", canonicalName: "Protocolo para manchas", evidence: "Protocolo para manchas", kind: "uncertain", explicit: true },
        ],
        coverages: [],
        alerts: [],
      })
    );

    expect(result.techniques).toEqual([]);
    expect(result.alerts).toContain("Confirme se “protocolo para manchas” é uma técnica realizada no estabelecimento.");
  });

  it("isola totalmente análises consecutivas de clientes A e B", async () => {
    const analyze = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          mentions: [{ name: "Microagulhamento", canonicalName: "Microagulhamento", evidence: "Microagulhamento", kind: "procedure", explicit: true }],
          coverages: [],
          alerts: [],
        },
        tokensUsed: 1,
      })
      .mockResolvedValueOnce({
        data: {
          mentions: [{ name: "Podologia", canonicalName: "Podologia", evidence: "Podologia", kind: "procedure", explicit: true }],
          coverages: [],
          alerts: [],
        },
        tokensUsed: 1,
      });

    const clientA = await extractExplicitTechniques(input("Microagulhamento"), [], analyze);
    clientA.techniques[0].name = "alterado fora do motor";
    const clientB = await extractExplicitTechniques(input("Podologia"), [], analyze);

    expect(clientB.techniques.map((item) => item.name)).toEqual(["Podologia"]);
    expect(JSON.stringify(clientB)).not.toContain("Microagulhamento");
  });
});

function pedido(procedimentos: string): CommercialPlannerInput {
  return { cliente: "Clínica", procedimentos, equipamentos: [] };
}

function analisador(analise: Record<string, unknown>) {
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

  it("não deixa prática proibida por lei virar técnica, mesmo se a análise insistir", async () => {
    const resultado = await extractExplicitTechniques(
      pedido("preenchimento labial e bioplastia com pmma"),
      [],
      analisador({
        mentions: [
          mencao("preenchimento labial", "procedure", "Preenchimento Dérmico com Ácido Hialurônico"),
          mencao("bioplastia com pmma", "procedure", "Bioplastia com PMMA"),
        ],
      })
    );

    expect(resultado.techniques.map((item) => item.name)).toEqual([
      "Preenchimento Dérmico com Ácido Hialurônico",
    ]);
    expect(resultado.alerts.some((alerta) => /legislação sanitária/.test(alerta))).toBe(true);
  });

  it("não pede confirmação de prática proibida", async () => {
    const resultado = await extractExplicitTechniques(
      pedido("escova progressiva com formol"),
      [],
      analisador({ mentions: [mencao("escova progressiva com formol", "uncertain")] })
    );

    expect(resultado.alerts.some((alerta) => /Confirme se/.test(alerta))).toBe(false);
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
