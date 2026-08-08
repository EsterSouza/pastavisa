import { runCommercialPlannerAnalysis } from "@/lib/ai";
import { buildPlannerPrompts } from "./prompts";
import type {
  CommercialPlannerInput,
  ExtractionResult,
  PlannerAnalyzer,
  PlannerCatalogItem,
} from "./types";
import { validatePlannerAnalysis } from "./validation";

export function normalizeTechnique(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function evidenceExists(source: string, evidence: string): boolean {
  return normalizeTechnique(source).includes(normalizeTechnique(evidence));
}

export async function extractExplicitTechniques(
  input: CommercialPlannerInput,
  catalog: PlannerCatalogItem[],
  analyzer: PlannerAnalyzer = runCommercialPlannerAnalysis
): Promise<ExtractionResult> {
  const { systemPrompt, userPrompt } = buildPlannerPrompts(input, catalog);
  const response = await analyzer(systemPrompt, userPrompt);
  const analysis = validatePlannerAnalysis(response.data);
  const techniques = new Map<string, { name: string; evidence: string[] }>();

  for (const mention of analysis.mentions) {
    if (mention.kind !== "procedure" || !mention.explicit) continue;
    if (!evidenceExists(input.procedimentos, mention.evidence)) continue;
    const key = normalizeTechnique(mention.canonicalName);
    if (!key) continue;
    const existing = techniques.get(key);
    if (existing) {
      if (!existing.evidence.includes(mention.evidence)) existing.evidence.push(mention.evidence);
    } else {
      techniques.set(key, { name: mention.canonicalName, evidence: [mention.evidence] });
    }
  }

  const alerts = [...analysis.alerts];
  for (const mention of analysis.mentions) {
    if (mention.kind === "uncertain") {
      alerts.push(`Confirme se “${mention.name}” é uma técnica realizada no estabelecimento.`);
    }
  }
  if (techniques.size === 0) {
    alerts.push("Nenhuma técnica de procedimento foi identificada de forma explícita.");
  }

  return {
    techniques: Array.from(techniques.values()),
    coverages: analysis.coverages,
    alerts: Array.from(new Set(alerts)),
  };
}
