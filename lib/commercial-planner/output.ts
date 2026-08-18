import type { InternalCommercialPlan, PublicCommercialPlan, PublicPlannerDocument } from "./types";

function publicDocumentName(value: string): string {
  return value
    .replace(/^TEMPLATE[_\s-]*/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function publicAlert(value: string): string {
  return /cat[aá]logo|template|prompt|score|pontua[cç][aã]o|confian[cç]a|classifica[cç][aã]o|coverage|cobertura interna/i.test(value)
    ? "Uma correspondência documental precisa de validação técnica."
    : value;
}

export function toPublicPlannerOutput(plan: InternalCommercialPlan): PublicCommercialPlan {
  // O vínculo documento → procedimento existe para a retirada do PV-009: sem ele o
  // comercial não teria como saber quais documentos caem ao tirar um procedimento.
  // Usa apenas nomes públicos; nunca id de catálogo, modo de cobertura ou pontuação.
  const documentsByName = new Map<string, { documento: PublicPlannerDocument; procedimentos: Set<string> }>();

  for (const document of plan.documents) {
    const documento = { nome: publicDocumentName(document.documentName), tipo: document.documentType };
    const key = `${documento.tipo}:${documento.nome}`.toLocaleLowerCase("pt-BR");
    const entry = documentsByName.get(key) ?? { documento, procedimentos: new Set<string>() };
    document.techniques.forEach((technique) => entry.procedimentos.add(technique));
    documentsByName.set(key, entry);
  }

  const entries = Array.from(documentsByName.values());

  return {
    procedimentos: plan.techniques.map((technique) => technique.name),
    documentos: entries.map((entry) => entry.documento),
    vinculos: entries.map((entry) => ({
      documento: entry.documento.nome,
      tipo: entry.documento.tipo,
      procedimentos: Array.from(entry.procedimentos),
    })),
    alertas: Array.from(new Set(plan.alerts.map(publicAlert))),
    resumo: {
      totalProcedimentos: plan.techniques.length,
      totalDocumentos: entries.length,
      revisaoTecnicaObrigatoria: true,
    },
    aviso: "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.",
  };
}
