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

function stripListMarker(line: string): string {
  return line
    .replace(/^[\s•·▪◦*-]+/, "")
    .replace(/^\s*\d+[\.)-]\s+/, "")
    .replace(/^\s*[a-zA-Z][\.)-]\s+/, "")
    .trim();
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function looksLikeDocumentTitle(line: string): boolean {
  const title = normalizeTitle(stripListMarker(line));
  if (title.length < 4 || title.length > 180) return false;
  if (EXCLUDED_LINE_PATTERNS.some((pattern) => pattern.test(title))) return false;

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

  const candidates = text.replace(/[•▪◦]/g, "\n").split(/\r?\n|\t/);

  for (const rawLine of candidates) {
    const nome = normalizeTitle(stripListMarker(rawLine));
    if (!looksLikeDocumentTitle(nome)) continue;

    const key = normalizeForComparison(nome);
    if (!key || encontrados.has(key)) continue;

    encontrados.set(key, {
      nome,
      tipo: inferirTipoDocumento(nome),
    });
  }

  return Array.from(encontrados.values());
}

export function mesclarDocumentosExtraidos(
  aiDocs: DocumentoExtraido[] | undefined,
  fallbackDocs: DocumentoExtraido[]
): DocumentoExtraido[] {
  const merged = new Map<string, DocumentoExtraido>();

  for (const doc of [...(aiDocs || []), ...fallbackDocs]) {
    const nome = normalizeTitle(doc.nome || "");
    if (!nome) continue;
    const key = normalizeForComparison(nome);
    if (!key || merged.has(key)) continue;
    merged.set(key, { nome, tipo: doc.tipo || inferirTipoDocumento(nome) });
  }

  return Array.from(merged.values());
}
