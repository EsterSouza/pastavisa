import type { PlannerFormat } from "./pricing";
import type { PublicCommercialPlan } from "./types";

/**
 * Rascunho do planejamento no navegador de quem está atendendo.
 *
 * Recarregar a página, perder a conexão ou fechar a aba por acidente não pode
 * custar o atendimento inteiro. O rascunho fica só na máquina de quem preenche —
 * nada disso vai para o servidor — e vence junto com o token assinado da análise,
 * que já não vale depois de duas horas.
 *
 * Quem apaga é o botão de recomeçar, e o vencimento.
 */

export const DRAFT_KEY = "pastavisa:planner:rascunho:v1";

/** Mesma validade do token assinado da análise: passado isso o rascunho é inútil. */
export const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export interface PlannerDraft {
  etapa: number;
  cliente: string;
  municipio: string;
  uf: string;
  procedimentos: string;
  equipamentos: string;
  reutilizaMateriais: boolean | null;
  possuiAutoclave: boolean | null;
  analise: { plano: PublicCommercialPlan; token: string } | null;
  retirados: string[];
  formato: PlannerFormat;
  salvoEm: number;
}

/**
 * Só devolve o armazenamento quando ele responde à API inteira. Navegador com
 * armazenamento bloqueado, aba anônima restrita ou ambiente de teste com um objeto
 * parcial devolvem null, e o planner segue funcionando sem rascunho.
 */
function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const store = window.localStorage;
    const completo =
      typeof store?.getItem === "function" &&
      typeof store?.setItem === "function" &&
      typeof store?.removeItem === "function";
    return completo ? store : null;
  } catch {
    return null;
  }
}

function descartar(store: Storage): void {
  try {
    store.removeItem(DRAFT_KEY);
  } catch {
    // Nada a fazer: o rascunho simplesmente não é reaproveitado.
  }
}

export function readDraft(): PlannerDraft | null {
  const store = storage();
  if (!store) return null;

  try {
    const bruto = store.getItem(DRAFT_KEY);
    if (!bruto) return null;
    const rascunho = JSON.parse(bruto) as PlannerDraft;
    if (typeof rascunho?.salvoEm !== "number" || Date.now() - rascunho.salvoEm > DRAFT_TTL_MS) {
      descartar(store);
      return null;
    }
    return rascunho;
  } catch {
    descartar(store);
    return null;
  }
}

export function writeDraft(rascunho: Omit<PlannerDraft, "salvoEm">): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(DRAFT_KEY, JSON.stringify({ ...rascunho, salvoEm: Date.now() }));
  } catch {
    // Cota estourada não pode derrubar o atendimento em andamento.
  }
}

export function clearDraft(): void {
  const store = storage();
  if (store) descartar(store);
}
