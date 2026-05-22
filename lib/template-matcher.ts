export interface MatchableTemplate {
  id: string;
  nome: string;
  tipo: string;
  arquivoPath?: string | null;
}

export interface TemplateMatch {
  templateId: string;
  score: number;
  specificity: number;
}

const STOP_WORDS = new Set([
  "a",
  "as",
  "ao",
  "aos",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "template",
  "ficha",
  "mbp",
  "pgrss",
  "planilha",
  "pop",
  "tcle",
  "termo",
]);

const SYNONYMS: Record<string, string> = {
  boas: "boa",
  praticas: "pratica",
  intercorrencias: "intercorrencia",
  adversos: "adverso",
  pacientes: "paciente",
  residuos: "residuo",
  seguranca: "seguranca",
  bioestimuladores: "bioestimulador",
  termos: "termo",
  bbglow: "bbglow",
  botox: "botulinica",
  ambientes: "desinfeccao",
  ambiente: "desinfeccao",
  artigos: "materiais",
  procedimento: "tratamento",
  procedimentos: "tratamento",
  manutencao: "equipamentos",
};

const TYPE_ALIASES: Record<string, string[]> = {
  mbp: ["manual boas praticas"],
  pgrss: ["plano gerenciamento residuos servicos saude"],
  pop: ["procedimento operacional padrao"],
  psp: ["plano seguranca paciente"],
  tcle: ["termo consentimento livre esclarecido"],
};

const PRIORITY_TOKENS = new Set([
  "bbglow",
  "bioestimulador",
  "botulinica",
  "estria",
  "gel",
  "gluteo",
  "labial",
  "plasma",
  "rinomodelacao",
]);

function normalize(text: string): string {
  return text
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalToken(token: string): string {
  if (["mbp", "pgrss", "pop", "psp", "tcle"].includes(token)) return token;
  if (SYNONYMS[token]) return SYNONYMS[token];
  if (token.length > 5 && token.endsWith("oes")) return `${token.slice(0, -3)}ao`;
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function tokenize(text: string, keepStopWords = false): string[] {
  return normalize(text)
    .split(" ")
    .map(canonicalToken)
    .filter((token) => token.length > 1 && (keepStopWords || !STOP_WORDS.has(token)));
}

function templateFileName(template: MatchableTemplate): string {
  if (!template.arquivoPath) return "";
  return template.arquivoPath
    .split(/[\\/]/)
    .pop()!
    .replace(/^bulk_\d+_/i, "")
    .replace(/\.(docx|docm)$/i, "");
}

function significantPhrase(text: string): string {
  return tokenize(text).join(" ");
}

function acronyms(text: string): Set<string> {
  const result = new Set<string>();
  const raw = text.match(/\b[A-Z]{2,}\b/g) || [];
  for (const item of raw) result.add(item.toLowerCase());

  const tokens = tokenize(text, true).filter((token) => !STOP_WORDS.has(token));
  if (tokens.length >= 2) result.add(tokens.map((token) => token[0]).join(""));
  return result;
}

function diceScore(aTokens: string[], bTokens: string[]): number {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const bRemaining = new Map<string, number>();
  for (const token of bTokens) bRemaining.set(token, (bRemaining.get(token) || 0) + 1);

  let overlap = 0;
  for (const token of aTokens) {
    const count = bRemaining.get(token) || 0;
    if (count > 0) {
      overlap += 1;
      bRemaining.set(token, count - 1);
    }
  }

  return (2 * overlap) / (aTokens.length + bTokens.length);
}

function longestContiguousOverlap(aTokens: string[], bTokens: string[]): number {
  let best = 0;
  for (let i = 0; i < aTokens.length; i += 1) {
    for (let j = 0; j < bTokens.length; j += 1) {
      let len = 0;
      while (aTokens[i + len] && aTokens[i + len] === bTokens[j + len]) len += 1;
      best = Math.max(best, len);
    }
  }
  return best;
}

function scoreCandidate(docName: string, candidate: string): number {
  const docNorm = normalize(docName);
  const candNorm = normalize(candidate);
  const docPhrase = significantPhrase(docName);
  const candPhrase = significantPhrase(candidate);
  const docTokens = tokenize(docName);
  const candTokens = tokenize(candidate);

  if (docNorm === candNorm || docPhrase === candPhrase) return 120;
  if (!candNorm || candTokens.length === 0) return 0;

  let score = Math.round(diceScore(docTokens, candTokens) * 92);

  const docAcronyms = acronyms(docName);
  const candAcronyms = acronyms(candidate);
  const acronymMatched = Array.from(candAcronyms).some(
    (acronym) =>
      acronym.length >= 2 && (docAcronyms.has(acronym) || docTokens.includes(acronym))
  );
  if (acronymMatched) {
    score += candTokens.length <= 1 ? 28 : 18;
  }

  if (candPhrase.length >= 4 && docPhrase.includes(candPhrase)) score = Math.max(score, 92);
  if (docPhrase.length >= 4 && candPhrase.includes(docPhrase)) score = Math.max(score, 88);

  const contiguous = longestContiguousOverlap(docTokens, candTokens);
  if (contiguous >= 2) score += Math.min(12, contiguous * 3);

  const distinctiveMatches = candTokens.filter(
    (token) => token.length >= 5 && docTokens.includes(token)
  ).length;
  score += Math.min(10, distinctiveMatches * 2);

  const missingPriority = docTokens.filter(
    (token) => PRIORITY_TOKENS.has(token) && !candTokens.includes(token)
  ).length;
  score -= Math.min(35, missingPriority * 14);

  if (
    docTokens.includes("relacao") &&
    docTokens.includes("equipamento") &&
    candTokens.includes("relacao") &&
    candTokens.includes("equipamento")
  ) {
    score += 18;
  }

  return Math.max(0, Math.min(score, 100));
}

function expandedCandidates(candidate: string): string[] {
  const normalized = normalize(candidate);
  const tokens = tokenize(candidate, true);
  const expansions = new Set([candidate]);

  for (const token of tokens) {
    for (const alias of TYPE_ALIASES[token] || []) {
      expansions.add(`${candidate} ${alias}`);
      if (normalized === token) expansions.add(alias);
    }
  }

  return Array.from(expansions);
}

export function findBestTemplateMatch(
  docName: string,
  templates: MatchableTemplate[],
  minScore = 62
): TemplateMatch | null {
  let best: TemplateMatch | null = null;
  const docTokensWithTypes = new Set(tokenize(docName, true));
  const expectedType =
    ["tcle", "pop", "planilha", "ficha", "termo", "mbp", "pgrss"].find((type) =>
      docTokensWithTypes.has(type)
    ) || (docTokensWithTypes.has("psp") ? "psp" : null);

  for (const template of templates) {
    const templateType = normalize(template.tipo);
    const templateNameTokens = new Set(tokenize(template.nome, true));
    if (
      expectedType &&
      expectedType !== "psp" &&
      templateType !== expectedType
    ) {
      continue;
    }
    if (expectedType === "psp" && !templateNameTokens.has("psp")) continue;

    const baseCandidates = [template.nome, templateFileName(template)];
    if (["mbp", "pgrss"].includes(templateType)) baseCandidates.push(template.tipo);
    const nameCandidates = baseCandidates.flatMap(expandedCandidates);
    const nameScore = Math.max(...nameCandidates.map((candidate) => scoreCandidate(docName, candidate)));
    const score = nameScore;
    const specificity = Math.max(
      tokenize(template.nome).length,
      tokenize(templateFileName(template)).length
    );

    if (
      !best ||
      score > best.score ||
      (score === best.score && specificity > best.specificity)
    ) {
      best = { templateId: template.id, score, specificity };
    }
  }

  return best && best.score >= minScore ? best : null;
}
