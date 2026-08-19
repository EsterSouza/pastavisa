import { describe, expect, it } from "vitest";
import { toPublicPlannerOutput } from "@/lib/commercial-planner/output";
import { validatePlannerInput, PlannerValidationError } from "@/lib/commercial-planner/validation";
import type { InternalCommercialPlan } from "@/lib/commercial-planner/types";

describe("validação e saída pública", () => {
  it("valida os campos mínimos sem compartilhar referências mutáveis", () => {
    const equipamentos = ["Autoclave A"];
    const validated = validatePlannerInput({ cliente: " Cliente A ", procedimentos: " Limpeza de Pele ", equipamentos });
    equipamentos.push("Equipamento B");

    expect(validated).toMatchObject({ cliente: "Cliente A", procedimentos: "Limpeza de Pele", equipamentos: ["Autoclave A"] });
    expect(() => validatePlannerInput({ cliente: "", procedimentos: "Técnica" })).toThrow(PlannerValidationError);
  });

  it("remove catálogo, IDs, classificação, pontuação e prompts da saída pública", () => {
    const candidate = {
      key: "internal-key",
      catalogId: "secret-id",
      documentName: "TEMPLATE_POP_MICROAGULHAMENTO",
      documentType: "POP",
      role: "procedure" as const,
      techniques: ["Microagulhamento"],
      mode: "exact" as const,
      equivalent: true,
      uncertain: false,
    };
    const coverage = {
      techniques: [{ name: "Microagulhamento", evidence: ["microagulhamento"] }],
      candidates: [candidate],
      alerts: [],
    };
    const internal: InternalCommercialPlan = {
      techniques: coverage.techniques,
      documents: [candidate],
      alerts: ["O template e o catálogo precisam de conferência de score."],
      coverage,
    };
    const output = toPublicPlannerOutput(internal);
    const serialized = JSON.stringify(output).toLowerCase();

    // O nome sai da técnica declarada, não do arquivo de origem, e o alerta que só
    // descreve o funcionamento interno não chega ao comercial.
    expect(output.documentos).toEqual([{ nome: "POP — Microagulhamento", tipo: "POP" }]);
    expect(output.alertas).toEqual([]);
    for (const forbidden of ["secret-id", "catalog", "catálogo", "template", "prompt", "score", "coverage", "exact"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(output.aviso).toBe("Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.");
  });

  it("não deixa passar alerta que cita documento pelo nome de origem", () => {
    // A calibragem em produção pegou este alerta: a análise perguntou se "o TCLE
    // MICROPIGMENTACAO FACIAL cobre ambas as regiões" e o nome interno chegaria ao
    // cliente. Sigla solta continua valendo — é a sequência longa que denuncia.
    const plan: InternalCommercialPlan = {
      techniques: [],
      documents: [],
      alerts: [
        "Confirme se o TCLE MICROPIGMENTACAO FACIAL cobre sobrancelha e lábio.",
        "Confirme se o PGRSS e o MBP já existem no estabelecimento.",
        "Confirme se a cliente realiza PRP com centrífuga própria.",
      ],
      coverage: { techniques: [], candidates: [], alerts: [] },
    };

    expect(toPublicPlannerOutput(plan).alertas).toEqual([
      "Confirme se o PGRSS e o MBP já existem no estabelecimento.",
      "Confirme se a cliente realiza PRP com centrífuga própria.",
    ]);
  });
});
