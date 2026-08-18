import { canonicalDocument, nameFromTechnique, procedureDocumentName } from "./naming";
import type { InternalCommercialPlan, PublicCommercialPlan, PublicPlannerDocument } from "./types";

/** Categorias entregues em outros trabalhos, que não são elaboradas dentro desta pasta. */
const TIPOS_FORA_DA_PASTA = new Set(["RECEITUARIO", "RECEITUÁRIO", "CONTRATO", "CERTIFICADO", "LICENCA", "LICENÇA", "ANEXO", "TREINAMENTO"]);
const NOMES_FORA_DA_PASTA =
  /^(contrato|anexo|certificad|licen[cç]a|alvar[aá]|treinamento|capacita[cç][aã]o|receitu[aá]rio|orienta[cç][oõ]es? p[oó]s|orienta[cç][aã]o p[oó]s)/i;

function foraDaPasta(documento: PublicPlannerDocument): boolean {
  return TIPOS_FORA_DA_PASTA.has(documento.tipo.toUpperCase()) || NOMES_FORA_DA_PASTA.test(documento.nome);
}

/**
 * Alertas que descrevem o funcionamento interno não chegam ao cliente. O que o
 * comercial precisa ver é o que depende da declaração dele — nunca como a
 * correspondência documental foi decidida.
 */
function alertaInterno(value: string): boolean {
  return /cat[aá]logo|template|prompt|score|pontua[cç][aã]o|confian[cç]a|classifica[cç][aã]o|coverage|cobertura|correspond[eê]ncia|banco de dados|equival[eê]ncia material|intelig[eê]ncia artificial|\bIA\b/i.test(
    value
  );
}

export function toPublicPlannerOutput(plan: InternalCommercialPlan): PublicCommercialPlan {
  // O vínculo documento → procedimento existe para a retirada do PV-009: sem ele o
  // comercial não teria como saber quais documentos caem ao tirar um procedimento.
  // Usa apenas nomes públicos; nunca id de origem, modo de cobertura ou pontuação.
  const documentsByName = new Map<string, { documento: PublicPlannerDocument; procedimentos: Set<string> }>();

  for (const document of plan.documents) {
    // POP e TCLE de procedimento são nomeados pela técnica declarada; os demais têm
    // nome oficial próprio, que não depende de nenhuma técnica.
    const documento: PublicPlannerDocument = nameFromTechnique(document.role)
      ? {
          nome: procedureDocumentName(document.documentType, document.techniques),
          tipo: document.documentType.toUpperCase(),
        }
      : canonicalDocument(document.documentName, document.documentType);
    if (foraDaPasta(documento)) continue;

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
    alertas: Array.from(new Set(plan.alerts.filter((alerta) => !alertaInterno(alerta)))),
    resumo: {
      totalProcedimentos: plan.techniques.length,
      totalDocumentos: entries.length,
      revisaoTecnicaObrigatoria: true,
    },
    aviso: "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.",
  };
}
