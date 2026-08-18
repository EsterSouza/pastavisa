import { runCommercialPlannerAnalysis } from "@/lib/ai";
import { buildPlannerPrompts } from "./prompts";
import { outOfScopeAlerts, outOfScopeReason } from "./scope";
import type {
  CommercialPlannerInput,
  ExtractionResult,
  PlannerAnalyzer,
  PlannerCatalogItem,
  RestrictionReason,
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

const RESTRICTION_TEXT: Record<RestrictionReason, string> = {
  sem_evidencia: "não tem evidência técnico-científica consolidada",
  legislacao_desfavoravel: "tem legislação desfavorável ou restritiva",
  fora_de_habilitacao: "pode exigir habilitação profissional específica",
};

/**
 * Ressalva sobre a técnica em si, para a especialista decidir se ela entra. O texto
 * diz o motivo e devolve a decisão a quem tem competência para tomá-la.
 */
function restrictionAlert(technique: string, reason: RestrictionReason, detail: string): string {
  const motivo = `“${technique}” ${RESTRICTION_TEXT[reason]} e fica sujeita à análise da especialista.`;
  return detail ? `${motivo} ${detail}` : motivo;
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

  // A fronteira do escopo é barrada aqui, não confiada ao prompt: técnica de outro
  // regime sanitário — cirurgia, odontologia, imagem, laboratório — não pode virar
  // POP nem TCLE, ainda que a análise a devolva como procedimento.
  const alerts = [...analysis.alerts, ...outOfScopeAlerts(input.procedimentos, analysis.alerts)];
  for (const key of Array.from(techniques.keys())) {
    const technique = techniques.get(key);
    if (technique && outOfScopeReason(technique.name)) techniques.delete(key);
  }

  for (const mention of analysis.mentions) {
    if (mention.kind !== "uncertain") continue;
    // Item fora do escopo já tem aviso próprio: pedir confirmação dele confundiria,
    // porque a resposta não é “sim, faço”, e sim “isso não entra nesta pasta”.
    if (outOfScopeReason(mention.name)) continue;
    alerts.push(`Confirme se “${mention.name}” é uma técnica realizada no estabelecimento.`);
  }

  // A restrição só vira ressalva quando recai sobre uma técnica que ficou no plano:
  // ressalva sobre técnica que não entrou confundiria quem lê.
  for (const restriction of analysis.restrictions) {
    const key = normalizeTechnique(restriction.technique);
    const technique = techniques.get(key);
    if (!technique) continue;
    alerts.push(restrictionAlert(technique.name, restriction.reason, restriction.detail));
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
