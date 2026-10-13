import { LEGISLATION_LIBRARY, matchesScope, toUF, type LegislationEntry } from "@visa/legislacao";
import type { ReferenciaPlanejada } from "./tipos";

// As referências do planejamento saem só do banco VISA Legislação (cada ato foi
// conferido na fonte). A IA escolhe por id; o texto ABNT vem do banco, nunca da IA.

export interface CandidataReferencia {
  id: string;
  nome: string;
  autoria: string;
  ementa: string;
  abrangencia: string;
}

type Entrada = LegislationEntry & { destaque?: string };

function abrangencia(e: Entrada): string {
  if (!e.uf) return "federal";
  return e.municipio ? `municipal (${e.municipio}/${toUF(e.uf)})` : `estadual (${toUF(e.uf)})`;
}

/** Atos em vigor que alcançam o território da cliente, numerados para a IA escolher. */
export function candidatasDoBanco(uf: string, municipio: string) {
  const mapa = new Map<string, Entrada>();
  const lista: CandidataReferencia[] = [];
  LEGISLATION_LIBRARY.forEach((e, i) => {
    if (e.status === "revogada" || e.status === "suspensa") return;
    if (!e.abnt && !e.url) return;
    if (!matchesScope(e, { uf, municipio })) return;
    const id = `L${String(i + 1).padStart(4, "0")}`;
    mapa.set(id, e);
    lista.push({ id, nome: e.name, autoria: e.authority, ementa: e.summary, abrangencia: abrangencia(e) });
  });
  return { mapa, lista };
}

const DISPONIVEL = /\s*Dispon[ií]vel em:\s*(\S+?)\.?\s*$/i;

/** Referência pronta para o DOCX: texto ABNT do banco sem o "Disponível em", o link e o destaque. */
export function referenciaDoBanco(e: Entrada): ReferenciaPlanejada {
  const abnt = (e.abnt || "").trim();
  const match = abnt.match(DISPONIVEL);
  const texto = (match ? abnt.slice(0, match.index) : abnt) || `${e.authority}. ${e.name}. ${e.summary}`;
  return {
    texto: texto.trim(),
    url: match?.[1] || e.url || undefined,
    destaque: e.destaque || undefined,
    naoConferida: e.status === "nao_verificado" || undefined,
  };
}

const MESES = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/** "2026-10-13" → "13 out. 2026", como a NBR 6023 abrevia o mês. */
export function dataAcesso(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return `${dia} ${MESES[mes - 1]} ${ano}`;
}
