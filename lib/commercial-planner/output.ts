import { nameFromTechnique, officialDocument, procedureDocumentName } from "./naming";
import type { InternalCommercialPlan, PublicCommercialPlan, PublicPlannerDocument } from "./types";

/** Categorias entregues em outros trabalhos, que não são elaboradas dentro desta pasta. */
const TIPOS_FORA_DA_PASTA = new Set(["RECEITUARIO", "RECEITUÁRIO", "CONTRATO", "CERTIFICADO", "LICENCA", "LICENÇA", "ANEXO", "TREINAMENTO"]);
const NOMES_FORA_DA_PASTA =
  /^(contrato|anexo|certificad|licen[cç]a|alvar[aá]|treinamento|capacita[cç][aã]o|receitu[aá]rio|orienta[cç][oõ]es? p[oó]s|orienta[cç][aã]o p[oó]s)/i;

/**
 * Ordem em que a pasta é entregue: institucionais primeiro, depois os POPs, as
 * fichas, os termos, os registros de controle e por fim o que não se encaixa.
 * É a ordem em que a equipe monta a pasta física.
 */
const ORDEM_TIPO = [
  "MBP",
  "PGRSS",
  "PLANO",
  "RELAÇÃO",
  "REGULAMENTO",
  "POP",
  "FICHA",
  "TCLE",
  "TERMO",
  "PLANILHA",
  "FORMULÁRIO",
  "REGISTRO",
  "PROTOCOLO",
  "GUIA",
];

/** Dentro do mesmo tipo, o Plano de Segurança do Paciente vem antes dos outros planos. */
const PRIMEIRO_NO_TIPO = new Map([["PLANO", "Plano de Segurança do Paciente"]]);

function posicaoTipo(tipo: string): number {
  const indice = ORDEM_TIPO.indexOf(tipo.toUpperCase());
  return indice < 0 ? ORDEM_TIPO.length : indice;
}

function ordenar(a: PublicPlannerDocument, b: PublicPlannerDocument): number {
  const porTipo = posicaoTipo(a.tipo) - posicaoTipo(b.tipo);
  if (porTipo !== 0) return porTipo;
  const destaque = PRIMEIRO_NO_TIPO.get(a.tipo.toUpperCase());
  if (destaque) {
    if (a.nome === destaque) return b.nome === destaque ? 0 : -1;
    if (b.nome === destaque) return 1;
  }
  return a.nome.localeCompare(b.nome, "pt-BR");
}

function foraDaPasta(documento: PublicPlannerDocument): boolean {
  return TIPOS_FORA_DA_PASTA.has(documento.tipo.toUpperCase()) || NOMES_FORA_DA_PASTA.test(documento.nome);
}

/**
 * Alertas que descrevem o funcionamento interno não chegam ao cliente. O que o
 * comercial precisa ver é o que depende da declaração dele — nunca como a
 * correspondência documental foi decidida.
 */
function alertaInterno(value: string): boolean {
  return (
    /cat[aá]logo|template|prompt|score|pontua[cç][aã]o|confian[cç]a|classifica[cç][aã]o|coverage|cobertura|correspond[eê]ncia|banco de dados|equival[eê]ncia material|intelig[eê]ncia artificial|\bIA\b|fam[ií]lia de documento|cobrir fam[ií]lia|documento gen[eé]rico|documentos? equivalentes?|\bmapead/i.test(
      value
    ) || nomeDeOrigem(value)
  );
}

/**
 * Nome de documento copiado da origem, em caixa alta e sem acento — o formato em que
 * os arquivos internos são nomeados. A calibragem pegou um alerta perguntando se "o
 * TCLE MICROPIGMENTACAO FACIAL cobre ambas as regiões": nome interno na frente do
 * cliente. Sigla solta continua passando; é a sequência longa que denuncia a origem.
 */
function nomeDeOrigem(value: string): boolean {
  const sequencias = value.match(/\b[A-Z][A-Z0-9]+(?:\s+[A-Z][A-Z0-9]+)+\b/g) ?? [];
  return sequencias.some((sequencia) => sequencia.replace(/\s+/g, "").length >= 10);
}

export function toPublicPlannerOutput(plan: InternalCommercialPlan): PublicCommercialPlan {
  // O vínculo documento → procedimento existe para a retirada do PV-009: sem ele o
  // comercial não teria como saber quais documentos caem ao tirar um procedimento.
  // Usa apenas nomes públicos; nunca id de origem, modo de cobertura ou pontuação.
  const documentsByName = new Map<string, { documento: PublicPlannerDocument; procedimentos: Set<string> }>();

  for (const document of plan.documents) {
    // POP e TCLE de procedimento são nomeados pela técnica declarada, que veio do
    // texto do próprio cliente. Os demais só saem se forem documento que a pasta
    // entrega de verdade: sem verbete oficial, o documento é descartado em vez de
    // chegar ao cliente com o nome que tinha na origem.
    const documento: PublicPlannerDocument | null = nameFromTechnique(document.role)
      ? {
          nome: procedureDocumentName(document.documentType, document.techniques),
          tipo: document.documentType.toUpperCase(),
        }
      : officialDocument(document.documentName);
    if (!documento || foraDaPasta(documento)) continue;

    const key = `${documento.tipo}:${documento.nome}`.toLocaleLowerCase("pt-BR");
    const entry = documentsByName.get(key) ?? { documento, procedimentos: new Set<string>() };
    document.techniques.forEach((technique) => entry.procedimentos.add(technique));
    documentsByName.set(key, entry);
  }

  const entries = Array.from(documentsByName.values()).sort((a, b) => ordenar(a.documento, b.documento));

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
