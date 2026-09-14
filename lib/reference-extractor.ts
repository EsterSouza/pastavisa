import { encontrarReferenciaDuplicada, type ReferenciaComparavel } from "@/lib/reference-deduplication";

export interface ReferenciaDetectadaInput {
  estadoUf: string;
  municipio?: string | null;
  tipo: string;
  titulo: string;
  referenciaAbnt: string;
  destaqueAbnt?: string | null;
  ativo: boolean;
}

export interface ReferenceScopeOptions {
  estadoUf?: string | null;
  municipio?: string | null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[º°]/g, "o")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanLine(value: string): string {
  return value
    .replace(/^[\s\-•*·\d.)]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUrlLine(line: string): boolean {
  return /^https?:\/\//i.test(line.trim());
}

function hasUrl(line: string): boolean {
  return /https?:\/\//i.test(line);
}

function looksLikeReference(line: string): boolean {
  const text = normalize(line);
  return [
    /\b(RDC|INSTRUCAO NORMATIVA|RESOLUCAO|PORTARIA|LEI|DECRETO|DECRETO LEI|NORMA REGULAMENTADORA|NR|NOTA TECNICA|PARECER)\b/,
    /\b(BRASIL|DISTRITO FEDERAL|MUNICIPIO|MUNICIPAL|ESTADUAL|ANVISA|COFEN|COREN|ABNT|MINISTERIO DA SAUDE|MINISTERIO DO TRABALHO|SECRETARIA DE SAUDE|VIGILANCIA SANITARIA|CVS)\b/,
    /\bN[O.]?\s*\d{1,5}(?:[./-]\d{2,4})?\b/,
  ].some((pattern) => pattern.test(text));
}

/**
 * A entrada ABNT abre com a autoria em caixa alta seguida de ponto: "PARÁ.",
 * "COFEN.", "RIO GRANDE DO SUL. Secretaria da Saúde.". Sem isto, uma estadual
 * ou municipal que não começa por BRASIL/ANVISA virava continuação da entrada
 * de cima e sumia dentro dela.
 */
function startsWithAbntAuthor(line: string): boolean {
  return /^[A-ZÀ-Ý][A-ZÀ-Ý0-9 ()\/&'-]{1,80}\.\s/.test(line.trim());
}

function looksLikeReferenceStart(line: string): boolean {
  const text = normalize(line);
  return (
    startsWithAbntAuthor(line) ||
    (looksLikeReference(line) &&
      /^(BRASIL|DISTRITO FEDERAL|MUNICIPIO|PREFEITURA|ESTADO|ANVISA|ABNT|ASSOCIACAO|CONSELHO|MINISTERIO|SECRETARIA|RDC|NR|LEI|DECRETO|PORTARIA|RESOLUCAO|INSTRUCAO NORMATIVA|NOTA TECNICA|PARECER)\b/.test(text))
  );
}

function isReferenceSubheading(line: string): boolean {
  const text = normalize(line).replace(/^\d+\s*[.)-]?\s*/, "");
  return (
    text.length <= 120 &&
    !/\d/.test(text) &&
    !startsWithAbntAuthor(line) &&
    /^(LEGISLACAO|LEGISLACOES|REFERENCIAS?|BASE LEGAL|NORMAS?|FONTES|AMBITO|ESFERA)\b/.test(text)
  );
}

function isUppercaseHeading(line: string): boolean {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 4 && line.length <= 100 && line === line.toLocaleUpperCase("pt-BR");
}

function isContinuationLine(line: string): boolean {
  const text = normalize(line);
  return (
    isUrlLine(line) ||
    /^DISPONIVEL\s+EM\b/.test(text) ||
    /^ACESSO\s+(E\s+VALIDACAO\s+)?EM\b/.test(text) ||
    /^(BRASILIA|RIO DE JANEIRO|SAO PAULO|CURITIBA|BELO HORIZONTE|GOIANIA|FLORIANOPOLIS|PORTO ALEGRE|SALVADOR|RECIFE|FORTALEZA),?\s+[A-Z]{2}/.test(text)
  );
}

export function extractReferenceSection(documentText: string): string {
  const lines = documentText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const start = lines.findIndex(
    (line) => isReferenceSubheading(line) && !/^NORMAS?\b/.test(normalize(line))
  );

  if (start < 0) return "";

  const selected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const isNextHeading =
      selected.length > 1 &&
      !isReferenceSubheading(line) &&
      isUppercaseHeading(line) &&
      !startsWithAbntAuthor(line) &&
      !looksLikeReference(line);

    if (isNextHeading) break;
    selected.push(line);
  }

  return selected.join("\n");
}

function parseReferenceEntries(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length >= 3);

  const entries: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const entry = current.join(" ").replace(/\s+/g, " ").trim();
    // Título de subseção ("NORMAS E ORIENTAÇÕES DA ANVISA") cita órgão mas não
    // tem número nem endereço; artigo acadêmico tem autoria mas não é ato. A
    // tela abre com tudo marcado, então o que passar daqui vai para a base.
    const isAct = /\d/.test(entry) || hasUrl(entry);
    if (entry.length >= 12 && isAct && looksLikeReference(entry)) {
      entries.push(entry);
    }
    current = [];
  };

  lines.forEach((line) => {
    if (isReferenceSubheading(line)) {
      flush();
      return;
    }

    if (looksLikeReferenceStart(line)) {
      flush();
      current = [line];
      return;
    }

    if (current.length > 0 && isContinuationLine(line)) {
      current.push(line);
      return;
    }

    flush();

    if (!isUrlLine(line) && looksLikeReference(line)) {
      current = [line];
    }
  });

  flush();

  const seen = new Set<string>();
  return entries.filter((line) => {
    const key = normalize(line).replace(/[^A-Z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractReferenceLines(documentText: string): string[] {
  const section = extractReferenceSection(documentText);
  const fromSection = section ? parseReferenceEntries(section) : [];
  return fromSection.length > 0 ? fromSection : parseReferenceEntries(documentText);
}

function inferTipo(line: string): string {
  const text = normalize(line);
  if (text.includes("RDC")) return "federal_sanitario";
  if (text.includes("INSTRUCAO NORMATIVA")) return "sanitario";
  if (text.includes("COFEN") || text.includes("COREN")) return "federal_profissional";
  if (text.includes("ABNT") || text.includes("MANUAL")) return "federal_tecnico";
  if (text.includes("LEI") || text.includes("DECRETO")) return "legal";
  return "referencia_extraida";
}

function inferEstado(line: string, options?: ReferenceScopeOptions): string {
  const text = normalize(line);
  if (/\b(BRASIL|ANVISA|COFEN|ABNT|MINISTERIO DA SAUDE|MINISTERIO DO TRABALHO|RDC|NR)\b/.test(text)) return "BR";
  if (/\bDISTRITO FEDERAL\b/.test(text)) return "DF";
  const explicitUf = text.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (explicitUf) return explicitUf[1];
  return (options?.estadoUf || "BR").toUpperCase();
}

function inferMunicipio(line: string, estadoUf: string, options?: ReferenceScopeOptions): string | null {
  if (estadoUf === "BR") return null;
  const text = normalize(line);
  if (/\b(MUNICIPIO|MUNICIPAL|PREFEITURA|SECRETARIA MUNICIPAL|SMS)\b/.test(text)) {
    return options?.municipio || null;
  }
  return null;
}

function inferDestaque(line: string): string | null {
  const trimmed = line.trim();
  const beforeDash = trimmed.split(/\s+[—-]\s+/)[0]?.trim();
  if (beforeDash && beforeDash.length >= 6 && beforeDash.length <= 90) return beforeDash;
  const firstSentence = trimmed.split(".")[0]?.trim();
  return firstSentence && firstSentence.length <= 90 ? firstSentence : null;
}

function inferTitulo(line: string): string {
  const beforeDash = line.split(/\s+[—-]\s+/)[0]?.trim();
  if (beforeDash && beforeDash.length >= 6) return beforeDash;
  return line.length > 120 ? `${line.slice(0, 117).trim()}...` : line;
}

export function extrairReferenciasDoDocumento(
  documentText: string,
  options?: ReferenceScopeOptions
): ReferenciaDetectadaInput[] {
  return extractReferenceLines(documentText).map((line) => {
    const estadoUf = inferEstado(line, options);
    return {
      estadoUf,
      municipio: inferMunicipio(line, estadoUf, options),
      tipo: inferTipo(line),
      titulo: inferTitulo(line),
      referenciaAbnt: line,
      destaqueAbnt: inferDestaque(line),
      ativo: true,
    };
  });
}

export function detectarReferenciasNaoCadastradas(
  documentText: string,
  existentes: ReferenciaComparavel[],
  options?: ReferenceScopeOptions
): ReferenciaDetectadaInput[] {
  return extrairReferenciasDoDocumento(documentText, options).filter(
    (candidate) => !encontrarReferenciaDuplicada(candidate, existentes)
  );
}
