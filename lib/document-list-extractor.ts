export interface DocumentoExtraido {
  nome: string;
  tipo: string;
}

const DOCUMENT_PREFIXES = [
  "POP",
  "MBP",
  "PGRSS",
  "TCLE",
  "MANUAL",
  "PLANO",
  "PLANILHA",
  "FICHA",
  "FORMULARIO",
  "FORMULÁRIO",
  "TERMO",
  "GUIA",
  "RECEITUARIO",
  "RECEITUÁRIO",
  "REGISTRO",
  "RELACAO",
  "RELAÇÃO",
  "CONTROLE",
  "CHECKLIST",
  "PROTOCOLO",
  "PROCEDIMENTO",
  "INSTRUCAO",
  "INSTRUÇÃO",
  "ENCAMINHAMENTO",
];

const EXCLUDED_LINE_PATTERNS = [
  /^DOCUMENTOS?\s+EM\s+ELABORA/i,
  /^DATA\s+DE\s+IN[ÍI]CIO/i,
  /^PRAZO\s+/i,
  /^STATUS\b/i,
  /^LEI\s+N[ºO]/i,
  /^RDC\s+N[ºO]/i,
  /^RESOLU[ÇC][ÃA]O\b/i,
  /^PORTARIA\b/i,
  /^NR[-\s]?\d+/i,
  /^REGISTRO\s+ANVISA\b/i,
  /^BRASIL\./i,
  /^DISTRITO\s+FEDERAL\./i,
  /https?:\/\//i,
  /\bCNPJ\b/i,
  /\bCPF\b/i,
];

// O "Documentos em Elaboração" também tem seções que não listam documento: os
// procedimentos informados, as tabelas de equipamento e insumo, a legislação.
// Lá dentro "Procedimento" é cabeçalho de coluna e "Controle da Glicemia" é o
// nome de um procedimento, e nenhum dos dois é documento a gerar.
const SECOES_SEM_DOCUMENTO =
  /^(RELACAO GERAL DE PROCEDIMENTOS|RELACAO DE EQUIPAMENTO|TABELA\b|MATRIZ\b|LEGISLACAO|LEGISLACOES|REFERENCIA|BASE LEGAL|IDENTIDADE VISUAL|ESTRUTURA FISICA|INFRAESTRUTURA)/;

// Nomes que só existem como título de seção ou cabeçalho de tabela.
const NOMES_GENERICOS =
  /^(PROCEDIMENTOS?( INFORMADOS?| VINCULADOS?| REALIZADOS?)?|RELACAO GERAL DE PROCEDIMENTOS\b.*|RELACAO DE EQUIPAMENTOS?( INFORMADOS?)?)$/;

function stripListMarker(line: string): string {
  return line
    .replace(/^[\s•·▪◦*-]+/, "")
    .replace(/^\s*\d+[\.)-]?\s+/, "")
    .replace(/^\s*[a-zA-Z][\.)-]\s+/, "")
    .trim();
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function normalizeTitle(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim()
    .replace(/[.;:,]+$/, "")
    .trim();
}

function sectionKey(line: string): string {
  return normalizeForComparison(stripListMarker(line)).replace(/^[IVXLC]+ /, "");
}

function isCaixaAlta(line: string): boolean {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 4 && line === line.toLocaleUpperCase("pt-BR");
}

function abreItemDeLista(line: string): boolean {
  return /^(\d+[.)]?\s+\S|[•·▪◦*-]\s*\S)/.test(line.trim());
}

function isNomeGenerico(nome: string): boolean {
  return NOMES_GENERICOS.test(normalizeForComparison(nome));
}

function looksLikeDocumentTitle(line: string): boolean {
  const title = normalizeTitle(stripListMarker(line));
  if (title.length < 4 || title.length > 180) return false;
  if (EXCLUDED_LINE_PATTERNS.some((pattern) => pattern.test(title))) return false;
  if (isNomeGenerico(title)) return false;

  const normalized = normalizeForComparison(title);
  const startsWithKnownPrefix = DOCUMENT_PREFIXES.some((prefix) => {
    const normalizedPrefix = normalizeForComparison(prefix);
    return normalized === normalizedPrefix || normalized.startsWith(`${normalizedPrefix} `);
  });

  if (startsWithKnownPrefix) return true;

  return (
    /\bMANUAL\s+DE\s+BOAS\s+PRATICAS\b/i.test(normalized) ||
    /\bPLANO\s+DE\s+GERENCIAMENTO\b/i.test(normalized) ||
    /\bSEGURANCA\s+DO\s+PACIENTE\b/i.test(normalized) ||
    /\bCONTROLE\s+DE\s+(LIMPEZA|TEMPERATURA|MANUTENCAO|ENTREGA)\b/i.test(normalized)
  );
}

export function inferirTipoDocumento(nome: string): string {
  const normalized = normalizeForComparison(nome);
  if (normalized.startsWith("MBP") || normalized.includes("MANUAL DE BOAS PRATICAS")) return "MBP";
  if (normalized.startsWith("POP") || normalized.includes("PROCEDIMENTO OPERACIONAL")) return "POP";
  if (normalized.startsWith("PGRSS") || normalized.includes("GERENCIAMENTO DE RESIDUOS")) return "PGRSS";
  if (normalized.startsWith("TCLE")) return "TCLE";
  if (normalized.startsWith("PLANILHA")) return "PLANILHA";
  if (normalized.startsWith("FICHA")) return "FICHA";
  if (normalized.startsWith("TERMO")) return "TERMO";
  if (normalized.startsWith("GUIA")) return "GUIA";
  if (normalized.startsWith("RECEITUARIO")) return "RECEITUARIO";
  return "OUTROS";
}

export function extrairDocumentosDoTextoElaboracao(text: string): DocumentoExtraido[] {
  const encontrados = new Map<string, DocumentoExtraido>();

  const lines = text
    .replace(/[•▪◦]/g, "\n")
    .split(/\r?\n|\t/)
    .map((line) => line.trim())
    .filter(Boolean);

  let dentroDeSecaoSemDocumento = false;

  lines.forEach((rawLine, index) => {
    if (isCaixaAlta(rawLine)) {
      const key = sectionKey(rawLine);
      // Título em caixa alta seguido de lista numerada é título de seção, não
      // documento ("FICHA DE AVALIAÇÃO" em cima de "1. Ficha de Anamnese...").
      const tituloDeSecao = abreItemDeLista(lines[index + 1] || "");
      if (SECOES_SEM_DOCUMENTO.test(key)) {
        dentroDeSecaoSemDocumento = true;
        return;
      }
      if (tituloDeSecao || (dentroDeSecaoSemDocumento && key.includes(" "))) {
        dentroDeSecaoSemDocumento = false;
        return;
      }
    }

    if (dentroDeSecaoSemDocumento) return;

    const nome = normalizeTitle(stripListMarker(rawLine));
    if (!looksLikeDocumentTitle(nome)) return;

    const key = normalizeForComparison(nome);
    if (!key || encontrados.has(key)) return;

    encontrados.set(key, {
      nome,
      tipo: inferirTipoDocumento(nome),
    });
  });

  return Array.from(encontrados.values());
}

export function mesclarDocumentosExtraidos(
  aiDocs: DocumentoExtraido[] | undefined,
  fallbackDocs: DocumentoExtraido[]
): DocumentoExtraido[] {
  const merged = new Map<string, DocumentoExtraido>();

  for (const doc of [...(aiDocs || []), ...fallbackDocs]) {
    const nome = normalizeTitle(doc.nome || "");
    if (!nome || isNomeGenerico(nome)) continue;
    const key = normalizeForComparison(nome);
    if (!key || merged.has(key)) continue;
    merged.set(key, { nome, tipo: doc.tipo || inferirTipoDocumento(nome) });
  }

  return Array.from(merged.values());
}
