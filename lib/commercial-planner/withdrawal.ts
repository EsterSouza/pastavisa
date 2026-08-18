import type { PublicCommercialPlan, PublicPlannerDocument } from "./types";

export interface WithdrawalResult {
  incluidos: string[];
  retirados: string[];
  documentos: PublicPlannerDocument[];
  totalProcedimentos: number;
  totalDocumentos: number;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

/**
 * Retirada de procedimentos pelo comercial.
 *
 * Um documento cai quando todos os procedimentos que ele atende foram retirados.
 * Documento sem procedimento vinculado — geral, registro, equipamento, esterilização —
 * permanece, porque ele não nasceu de uma técnica específica.
 *
 * Nomes que não estão no plano são ignorados: a retirada nunca inventa procedimento.
 */
export function applyWithdrawal(plan: PublicCommercialPlan, retirados: readonly string[]): WithdrawalResult {
  const pedidos = new Set(retirados.map(normalize));
  const incluidos = plan.procedimentos.filter((procedimento) => !pedidos.has(normalize(procedimento)));
  const removidos = plan.procedimentos.filter((procedimento) => pedidos.has(normalize(procedimento)));
  const mantidos = new Set(incluidos.map(normalize));

  const vinculoPorChave = new Map(
    plan.vinculos.map((vinculo) => [`${vinculo.tipo}:${vinculo.documento}`.toLocaleLowerCase("pt-BR"), vinculo])
  );

  const documentos = plan.documentos.filter((documento) => {
    const vinculo = vinculoPorChave.get(`${documento.tipo}:${documento.nome}`.toLocaleLowerCase("pt-BR"));
    const vinculados = vinculo?.procedimentos ?? [];
    return vinculados.length === 0 || vinculados.some((procedimento) => mantidos.has(normalize(procedimento)));
  });

  return {
    incluidos,
    retirados: removidos,
    documentos,
    totalProcedimentos: incluidos.length,
    totalDocumentos: documentos.length,
  };
}
