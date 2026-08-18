// seed/legislacoes.ts
// Projeção da base unificada (@visa/legislacao) no formato da tabela Legislacao.
//
// A lista escrita à mão que morava aqui virou parte do pacote, junto com a base
// do InspecVISA — são 118 atos contra os 47 de antes. Para acrescentar ou
// corrigir uma norma, edite `src/library.ts` do pacote; este arquivo só traduz.
//
// Para importar: npx tsx seed/run.ts

import { LEGISLATION_LIBRARY, formatAbnt, type LegislationEntry } from "@visa/legislacao";

export interface LegislacaoSeed {
  estadoUf: string;
  municipio: string | null;
  tipo: string;
  titulo: string;
  referenciaAbnt: string;
}

/** Conselhos e entidades de classe: o ato vale por profissão, não por território. */
const PROFISSIONAL = /\b(COFEN|CREMERJ|CNAS|CNDI|Conselho)\b/i;
/** Publicação técnica sem força de ato normativo próprio (manual, nota, CBO). */
const TECNICO = /^(Manual|Nota Técnica|CBO)\b/i;

/**
 * Reconstrói o `tipo` que a tela usa como etiqueta. A esfera vem do alcance
 * territorial do verbete; o sufixo distingue ato de conselho profissional e
 * publicação técnica dos atos normativos comuns.
 */
function tipoDe(entry: LegislationEntry): string {
  const esfera = entry.municipio ? "municipal" : entry.uf ? "estadual" : "federal";
  if (PROFISSIONAL.test(entry.name) || PROFISSIONAL.test(entry.authority)) {
    return `${esfera}_profissional`;
  }
  if (TECNICO.test(entry.name)) return `${esfera}_tecnico`;
  return esfera;
}

const legislacoes: LegislacaoSeed[] = LEGISLATION_LIBRARY.map((entry) => ({
  // A tabela usa "BR" onde o pacote usa uf nula para dizer "federal/nacional".
  estadoUf: entry.uf || "BR",
  municipio: entry.municipio ?? null,
  tipo: tipoDe(entry),
  titulo: entry.name,
  // `abnt` é a referência NBR 6023 completa quando o verbete tem uma; senão
  // formatAbnt monta a forma curta a partir de autoria, ementa e URL.
  referenciaAbnt: formatAbnt(entry.name, entry),
}));

export default legislacoes;
