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
    .replace(/[\u0300-\u036f]/g, "")
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

function looksLikeReference(line: string): boolean {
  const text = normalize(line);
  return [
    /\b(RDC|INSTRUCAO NORMATIVA|RESOLUCAO|PORTARIA|LEI|DECRETO|NORMA REGULAMENTADORA|NR|NOTA TECNICA|PARECER)\b/,
    /\b(ANVISA|COFEN|COREN|ABNT|MINISTERIO DA SAUDE|SECRETARIA DE SAUDE|CVS)\b/,
    /\bN[O.]?\s*\d{1,5}(?:[./-]\d{2,4})?\b/,
  ].some((pattern) => pattern.test(text));
}

export function extractReferenceSection(documentText: string): string {
  const lines = documentText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const start = lines.findIndex((line) => {
    const text = normalize(line);
    return /\b(REFERENCIAS|REFERENCIA|BASE LEGAL|LEGISLACAO APLICAVEL|LEGISLACOES APLICAVEIS|NORMAS APLICAVEIS)\b/.test(text);
  });

  if (start < 0) return "";

  const selected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const text = normalize(line);
    const isNextHeading =
      selected.length > 1 &&
      text.length <= 80 &&
      /^(?:\d+\s*[.)-]?\s*)?[A-Z0-9\s/,-]{6,}$/.test(text) &&
      !looksLikeReference(line);

    if (isNextHeading) break;
    selected.push(line);
  }

  return selected.join("\n");
}

export function extractReferenceLines(documentText: string): string[] {
  const section = extractReferenceSection(documentText) || documentText;
  const lines = section
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length >= 12 && looksLikeReference(line));

  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = normalize(line).replace(/[^A-Z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferTipo(line: string): string {
  const text = normalize(line);
  if (text.includes("RDC")) return "federal_sanitario";
  if (text.includes("COFEN") || text.includes("COREN")) return "federal_profissional";
  if (text.includes("ABNT") || text.includes("MANUAL")) return "federal_tecnico";
  if (text.includes("LEI") || text.includes("DECRETO")) return "legal";
  return "referencia_extraida";
}

function inferEstado(line: string, options?: ReferenceScopeOptions): string {
  const text = normalize(line);
  if (/\b(BRASIL|ANVISA|COFEN|ABNT|MINISTERIO DA SAUDE|RDC|NR)\b/.test(text)) return "BR";
  const explicitUf = text.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (explicitUf) return explicitUf[1];
  return (options?.estadoUf || "BR").toUpperCase();
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

export function detectarReferenciasNaoCadastradas(
  documentText: string,
  existentes: ReferenciaComparavel[],
  options?: ReferenceScopeOptions
): ReferenciaDetectadaInput[] {
  return extractReferenceLines(documentText)
    .map((line) => {
      const estadoUf = inferEstado(line, options);
      const candidate: ReferenciaDetectadaInput = {
        estadoUf,
        municipio: estadoUf === "BR" ? null : options?.municipio || null,
        tipo: inferTipo(line),
        titulo: inferTitulo(line),
        referenciaAbnt: line,
        destaqueAbnt: inferDestaque(line),
        ativo: true,
      };
      return candidate;
    })
    .filter((candidate) => !encontrarReferenciaDuplicada(candidate, existentes));
}
