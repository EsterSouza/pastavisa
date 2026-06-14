export interface ReferenciaComparavel {
  id?: string;
  estadoUf?: string | null;
  municipio?: string | null;
  titulo?: string | null;
  referenciaAbnt?: string | null;
  link?: string | null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "o")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function scope(reference: ReferenciaComparavel): string {
  return [reference.estadoUf || "BR", reference.municipio || ""]
    .map((part) => normalize(part))
    .join(":");
}

function findYear(value: string): string {
  const match = value.match(/\b((?:19|20)\d{2})\b/);
  return match?.[1] || "";
}

export function extrairUrlsReferencia(reference: ReferenciaComparavel): string[] {
  const text = `${reference.titulo || ""} ${reference.referenciaAbnt || ""} ${reference.link || ""}`;
  const urls = text.match(/https?:\/\/[^\s)\]}>,;]+/gi) || [];
  const seen = new Set<string>();
  return urls
    .map((url) =>
      url
        .trim()
        .replace(/[.,;:]+$/g, "")
        .replace(/^http:\/\//i, "https://")
        .replace(/\/+$/g, "")
        .toLowerCase()
    )
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

export function criarChaveReferencia(reference: ReferenciaComparavel): string {
  const text = normalize(`${reference.titulo || ""} ${reference.referenciaAbnt || ""}`);
  const instrumentText = `${reference.titulo || ""} ${reference.referenciaAbnt || ""}`
    .replace(/[º°]/g, "o")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const patterns: Array<[string, RegExp]> = [
    ["rdc", /\brdc\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["instrucao-normativa", /\binstrucao normativa\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["lei-complementar", /\blei complementar\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["lei", /\blei(?! complementar)\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["decreto-lei", /\bdecreto\s*lei\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["decreto", /\bdecreto(?: municipal| rio)?\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["resolucao-cofen", /\bresolucao cofen\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["resolucao-sms", /\bresolucao sms\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["resolucao", /\bresolucao\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["portaria", /\bportaria(?: gm\/ms)?\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["nr", /\bnr\s*[- ]?\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["nota-tecnica", /\bnota tecnica\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
    ["parecer", /\bparecer(?: normativo)?\s*(?:n\s*[o.]?\s*)?([\d.]+)/],
  ];
  for (const [kind, pattern] of patterns) {
    const match = instrumentText.match(pattern);
    if (match) {
      const number = match[1].replace(/\D/g, "");
      return `${scope(reference)}|${kind}|${number}|${findYear(text)}`;
    }
  }

  const title = normalize(reference.titulo || reference.referenciaAbnt || "");
  return `${scope(reference)}|texto|${title}`;
}

const STOP_WORDS = new Set([
  "a", "as", "ao", "aos", "da", "das", "de", "do", "dos", "e", "em", "no",
  "nos", "na", "nas", "o", "os", "para", "por", "que", "um", "uma", "com",
  "brasil", "dispoe", "sobre", "outras", "providencias", "disponivel",
]);

function meaningfulTokens(reference: ReferenciaComparavel): Set<string> {
  const text = normalize(`${reference.titulo || ""} ${reference.referenciaAbnt || ""}`);
  return new Set(
    text.split(" ").filter((token) => token.length > 2 && !STOP_WORDS.has(token))
  );
}

function overlapScore(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  left.forEach((token) => {
    if (right.has(token)) intersection += 1;
  });
  return intersection / Math.min(left.size, right.size);
}

export function encontrarReferenciaDuplicada(
  candidate: ReferenciaComparavel,
  existing: ReferenciaComparavel[],
  excludedId?: string
): ReferenciaComparavel | undefined {
  const candidateKey = criarChaveReferencia(candidate);
  const candidateTokens = meaningfulTokens(candidate);
  const candidateUrls = extrairUrlsReferencia(candidate);

  return existing.find((reference) => {
    if (reference.id === excludedId) return false;
    const referenceUrls = extrairUrlsReferencia(reference);
    if (
      candidateUrls.some((candidateUrl) =>
        referenceUrls.some(
          (referenceUrl) =>
            candidateUrl === referenceUrl ||
            candidateUrl.includes(referenceUrl) ||
            referenceUrl.includes(candidateUrl)
        )
      )
    ) {
      return true;
    }

    const referenceKey = criarChaveReferencia(reference);
    if (referenceKey === candidateKey) return true;
    if (!candidateKey.includes("|texto|") && !referenceKey.includes("|texto|")) {
      const [candidateScope, candidateKind, candidateNumber, candidateYear] = candidateKey.split("|");
      const [referenceScope, referenceKind, referenceNumber, referenceYear] = referenceKey.split("|");
      return (
        candidateScope === referenceScope &&
        candidateKind === referenceKind &&
        candidateNumber === referenceNumber &&
        (!candidateYear || !referenceYear || candidateYear === referenceYear)
      );
    }
    const score = overlapScore(candidateTokens, meaningfulTokens(reference));
    return scope(reference) === scope(candidate) ? score >= 0.82 : score >= 0.94;
  });
}
