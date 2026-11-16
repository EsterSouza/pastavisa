import type { Tone } from "@/components/ui/Status";

/**
 * Etapas da pasta depois da geração. Só as do meio ficam gravadas em Pasta.etapa:
 * "producao" é a pasta sem etapa e "entregue" é a pasta concluída (status
 * "concluida"), que é o que a retenção de 30 dias já usa.
 */
export const ETAPAS = ["producao", "apreciacao", "revisao", "impressao", "entregue"] as const;
export type Etapa = (typeof ETAPAS)[number];

const GRAVADAS: readonly string[] = ["apreciacao", "revisao", "impressao"];

export const ETAPA_INFO: Record<Etapa, { label: string; tone: Tone }> = {
  producao: { label: "Em produção", tone: "info" },
  apreciacao: { label: "Em apreciação", tone: "info" },
  revisao: { label: "Em revisão", tone: "atencao" },
  impressao: { label: "Em impressão", tone: "atencao" },
  entregue: { label: "Entregue", tone: "sucesso" },
};

export function etapaDa(pasta: { status: string; etapa?: string | null }): Etapa {
  if (pasta.status === "concluida") return "entregue";
  return GRAVADAS.includes(pasta.etapa || "") ? (pasta.etapa as Etapa) : "producao";
}

export function ehEtapa(valor: unknown): valor is Etapa {
  return typeof valor === "string" && (ETAPAS as readonly string[]).includes(valor);
}

/**
 * O que gravar para levar a pasta a uma etapa. "entregue" conclui; as outras
 * reabrem a pasta se ela estava concluída, o que zera a contagem dos 30 dias.
 */
export function gravacaoDaEtapa(etapa: Etapa, statusAtual: string): { status?: string; etapa?: string | null } {
  if (etapa === "entregue") return { status: "concluida" };
  return {
    etapa: etapa === "producao" ? null : etapa,
    ...(statusAtual === "concluida" ? { status: "rascunho" } : {}),
  };
}
