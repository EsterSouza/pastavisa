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

    expect(output.documentos).toEqual([{ nome: "POP MICROAGULHAMENTO", tipo: "POP" }]);
    expect(output.alertas).toEqual(["Uma correspondência documental precisa de validação técnica."]);
    for (const forbidden of ["secret-id", "catalog", "catálogo", "template", "prompt", "score", "coverage", "exact"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(output.aviso).toBe("Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.");
  });
});
