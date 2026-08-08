import type { InternalCommercialPlan, PublicCommercialPlan } from "./types";

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
  const documentsByName = new Map(
    plan.documents.map((document) => {
      const publicDocument = {
        nome: publicDocumentName(document.documentName),
        tipo: document.documentType,
      };
      return [`${publicDocument.tipo}:${publicDocument.nome}`.toLocaleLowerCase("pt-BR"), publicDocument];
    })
  );
  const documentos = Array.from(documentsByName.values());

  return {
    procedimentos: plan.techniques.map((technique) => technique.name),
    documentos,
    alertas: Array.from(new Set(plan.alerts.map(publicAlert))),
    resumo: {
      totalProcedimentos: plan.techniques.length,
      totalDocumentos: documentos.length,
      revisaoTecnicaObrigatoria: true,
    },
    aviso: "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.",
  };
}
