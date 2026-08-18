import { describe, expect, it } from "vitest";
import { buildCoverageMap } from "@/lib/commercial-planner/coverage";
import { buildMinimumPlan } from "@/lib/commercial-planner/plan";
import type { CommercialPlannerInput, ExtractionResult, PlannerCatalogItem } from "@/lib/commercial-planner/types";

const catalog: PlannerCatalogItem[] = [
  { id: "pop-a", name: "POP — Técnica A", type: "POP" },
  { id: "pop-b", name: "POP — Técnica B", type: "POP" },
  { id: "pop-family", name: "POP — Família A e B", type: "POP" },
  { id: "tcle-a", name: "TCLE — Técnica A", type: "TCLE" },
  { id: "tcle-b", name: "TCLE — Técnica B", type: "TCLE" },
  { id: "tcle-family", name: "TCLE — Família A e B", type: "TCLE" },
  { id: "sterile-pop", name: "POP — Processamento de Materiais Reutilizáveis", type: "POP" },
  { id: "sterile-record", name: "Registro de Esterilização em Autoclave", type: "PLANILHA" },
  { id: "equipment", name: "POP — Gestão de Equipamentos Eletromédicos", type: "POP" },
];

/** Documentos que nascem de uma técnica declarada, sem a base obrigatória da pasta. */
function porTecnica(plan: { documents: Array<{ role: string; documentName: string }> }): string[] {
  return plan.documents
    .filter((doc) => doc.role === "procedure" || doc.role === "consent")
    .map((doc) => doc.documentName);
}

function request(overrides: Partial<CommercialPlannerInput> = {}): CommercialPlannerInput {
  return { cliente: "Cliente", procedimentos: "Técnica A e Técnica B", equipamentos: [], ...overrides };
}

function extraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    techniques: [
      { name: "Técnica A", evidence: ["Técnica A"] },
      { name: "Técnica B", evidence: ["Técnica B"] },
    ],
    coverages: [],
    alerts: [],
    ...overrides,
  };
}

describe("mapa de cobertura e plano mínimo", () => {
  it("seleciona uma família equivalente uma única vez", () => {
    const coverage = buildCoverageMap(
      extraction({
        coverages: [
          { catalogId: "pop-family", documentName: "ignorado", documentType: "POP", role: "procedure", techniques: ["Técnica A", "Técnica B"], mode: "family", equivalent: true, uncertain: false },
          { catalogId: "tcle-family", documentName: "ignorado", documentType: "TCLE", role: "consent", techniques: ["Técnica A", "Técnica B"], mode: "family", equivalent: true, uncertain: false },
        ],
      }),
      catalog
    );
    const plan = buildMinimumPlan(request(), coverage);

    expect(porTecnica(plan)).toEqual(["POP — Família A e B", "TCLE — Família A e B"]);
  });

  it("não deixa TCLE amplo absorver técnicas sem equivalência material", () => {
    const coverage = buildCoverageMap(
      extraction({
        coverages: [
          { catalogId: "pop-a", documentName: "", documentType: "POP", role: "procedure", techniques: ["Técnica A"], mode: "exact", equivalent: true, uncertain: false },
          { catalogId: "pop-b", documentName: "", documentType: "POP", role: "procedure", techniques: ["Técnica B"], mode: "exact", equivalent: true, uncertain: false },
          { catalogId: "tcle-family", documentName: "", documentType: "TCLE", role: "consent", techniques: ["Técnica A", "Técnica B"], mode: "exact", equivalent: false, uncertain: false },
        ],
      }),
      catalog
    );
    const plan = buildMinimumPlan(request(), coverage);

    expect(porTecnica(plan)).toEqual([
      "POP — Técnica A",
      "POP — Técnica B",
      "TCLE — Técnica A",
      "TCLE — Técnica B",
    ]);
  });

  it("inclui esterilização somente com reutilização e autoclave confirmadas", () => {
    const coverages: ExtractionResult["coverages"] = [
      { catalogId: "pop-family", documentName: "", documentType: "POP", role: "procedure", techniques: ["Técnica A", "Técnica B"], mode: "family", equivalent: true, uncertain: false },
      { catalogId: "tcle-family", documentName: "", documentType: "TCLE", role: "consent", techniques: ["Técnica A", "Técnica B"], mode: "family", equivalent: true, uncertain: false },
      { catalogId: "sterile-pop", documentName: "", documentType: "POP", role: "sterilization", techniques: [], mode: "exact", equivalent: true, uncertain: false },
      { catalogId: "sterile-record", documentName: "", documentType: "PLANILHA", role: "sterilization", techniques: [], mode: "exact", equivalent: true, uncertain: false },
    ];
    const coverage = buildCoverageMap(extraction({ coverages }), catalog);

    const withoutAutoclave = buildMinimumPlan(request({ reutilizaMateriais: true, possuiAutoclave: false }), coverage);
    expect(withoutAutoclave.documents.some((doc) => doc.role === "sterilization")).toBe(false);
    expect(withoutAutoclave.alerts.some((alert) => alert.includes("autoclave"))).toBe(true);

    // Confirmada a autoclave, entram os dois documentos vindos da declaração e os
    // três que a pasta traz sempre que há processamento de material.
    const confirmed = buildMinimumPlan(request({ reutilizaMateriais: true, possuiAutoclave: true }), coverage);
    expect(confirmed.documents.filter((doc) => doc.role === "sterilization").map((doc) => doc.documentName).sort()).toEqual([
      "POP — Processamento de Materiais Reutilizáveis",
      "POP — Processamento, Limpeza e Desinfecção de Artigos, Instrumentais e Materiais Reutilizáveis",
      "POP — Validação e Monitoramento do Processo de Esterilização",
      "Registro de Esterilização em Autoclave",
      "Registro de Esterilização em Autoclave",
    ].sort());
  });

  it("não inclui documento de equipamento quando nenhum equipamento foi informado", () => {
    const coverage = buildCoverageMap(
      extraction({
        coverages: [
          { catalogId: "pop-family", documentName: "", documentType: "POP", role: "procedure", techniques: ["Técnica A", "Técnica B"], mode: "family", equivalent: true, uncertain: false },
          { catalogId: "tcle-family", documentName: "", documentType: "TCLE", role: "consent", techniques: ["Técnica A", "Técnica B"], mode: "family", equivalent: true, uncertain: false },
          { catalogId: "equipment", documentName: "", documentType: "POP", role: "equipment", techniques: [], mode: "exact", equivalent: true, uncertain: false },
        ],
      }),
      catalog
    );

    expect(buildMinimumPlan(request(), coverage).documents.some((doc) => doc.role === "equipment")).toBe(false);
    expect(buildMinimumPlan(request({ equipamentos: ["Laser X"] }), coverage).documents.some((doc) => doc.role === "equipment")).toBe(true);
  });

  it("cobre a técnica sem documento correspondente com POP e TCLE, sem virar pendência", () => {
    const coverage = buildCoverageMap(extraction(), catalog);
    const plan = buildMinimumPlan(request(), coverage);

    for (const technique of ["Técnica A", "Técnica B"]) {
      expect(plan.documents.some((doc) => doc.role === "procedure" && doc.techniques.includes(technique))).toBe(true);
      expect(plan.documents.some((doc) => doc.role === "consent" && doc.techniques.includes(technique))).toBe(true);
    }
    expect(plan.alerts).toEqual([]);
  });

  it("traz a base obrigatória da pasta mesmo sem nenhuma cobertura declarada", () => {
    const plan = buildMinimumPlan(request(), buildCoverageMap(extraction(), catalog));
    const nomes = plan.documents.map((doc) => doc.documentName);

    for (const obrigatorio of [
      "Manual de Boas Práticas em Serviço de Saúde",
      "Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS)",
      "Plano de Segurança do Paciente",
      "Plano de Contingência e Emergências",
      "POP — Higienização das Mãos",
      "POP — Paramentação e Uso de Equipamentos de Proteção Individual (EPIs)",
      "POP — Gerenciamento Interno de Resíduos",
      "POP — Prevenção e Conduta em Acidentes com Material Biológico",
      "POP — Consulta e Prontuário",
      "Planilha de Controle de Limpeza Concorrente e Terminal",
      "Guia de Utilização da Pasta Sanitária",
    ]) {
      expect(nomes).toContain(obrigatorio);
    }
  });

  it("não cria termo de consentimento para consulta e avaliação", () => {
    const coverage = buildCoverageMap(
      extraction({ techniques: [{ name: "Consulta e avaliação estética", evidence: ["consulta"] }] }),
      catalog
    );
    const plan = buildMinimumPlan(request({ procedimentos: "Consulta e avaliação estética" }), coverage);

    expect(porTecnica(plan)).toEqual(["POP — Consulta e avaliação estética"]);
  });
});
