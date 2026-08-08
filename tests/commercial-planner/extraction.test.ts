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
