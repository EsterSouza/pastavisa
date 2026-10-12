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
  // Aparecem em quase todo nome e não dizem qual é o documento: deixavam "PEIM -
  // Procedimento Estético Injetável" casar com "Acompanhamento Pré e Pós-procedimento Estético".
  "procedimento",
  "estetico",
  "estetica",
  "aplicacao",
  "fins",
  "tecnica",
  "tratamento",
  "nao",
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
  manutencao: "equipamentos",
  endermologia: "endermoterapia",
  podologico: "podologia",
  podologica: "podologia",
  dermopigmentacao: "micropigmentacao",
  lipocavitacao: "cavitacao",
  endovenosa: "intravenosa",
  endovenoso: "intravenosa",
  intravenoso: "intravenosa",
  preenchedor: "preenchimento",
  preenchedores: "preenchimento",
  capacitacao: "treinamento",
  capacitacoes: "treinamento",
  bebedouro: "purificador",
  bebedouros: "purificador",
  // Planilha de registro e de controle são a mesma coisa no acervo.
  registro: "controle",
  registros: "controle",
};

/**
 * Nomes que o planejamento usa para um documento que no acervo tem outro nome.
 * Cada troca gera mais uma versão do nome do documento para comparar; a original
 * continua valendo.
 */
const APELIDOS: Array<[RegExp, string]> = [
  [/limpeza concorrente( e terminal)?/, "limpeza e desinfeccao"],
  [/\bskin booster\b/, "skinbooster"],
  [/procedimento estetico injetavel (para|em) micro ?vasos|procedimento estetico para micro ?vasos/, "peim"],
  [/plasma rico em plaquetas( e fibrina rica em plaquetas)?|concentrados sanguineos autologos( nao transfusionais)?/, "hemoderivados prp e prf"],
  [/suplementacao (injetavel|endovenosa|intravenosa)|terapia infusional( endovenosa| intravenosa)?|soroterapia|vitaminas injetaveis/, "terapia ortomolecular intravenosa"],
  [/aplicacao de brincos? (em )?adultos?/, "furo humanizado e piercing em adultos"],
  [/aplicacao de brincos?/, "furo de orelha"],
  [/\bhifu\b.*|ultrassom (micro\w* e macro|macro\w* e micro)\w*( focado)?/, "hifu ultrassom macro e microfocado"],
  [/\bpeelings? (de |com )?(ata|acido tricloroacetico)\b.*/, "peelings quimicos com acido tricloroacetico"],
  [/glicemia capilar/, "controle da glicemia"],
  [/(manejo|descarte) de residuos/, "gerenciamento de residuos"],
  [/(limpeza do )?bebedouros?( e troca de filtros?)?|filtros? e bebedouros?/, "limpeza do purificador de agua"],
  [/caixa d ?agua|limpeza de reservatorio( de agua)?|qualidade da agua( e da limpeza do reservatorio)?/, "controle de potabilidade da agua"],
  [/(autorizacao (para|de) )?(uso de imagem|registro fotografico)( e voz| e registro fotografico| e uso de imagem)?/, "uso de imagem lgpd"],
  [/\b(recusa|renuncia|interrupcao|encerramento)\b.*$/, "renuncia e recusa de tratamento"],
  [/epilacao a laser/, "depilacao a laser"],
  // POP de manutenção/gestão de equipamentos é o "Gestão de Equipamentos". O
  // "Manutenção de Equipamentos" junta climatização e fica para quando o nome fala
  // dos dois; só ar-condicionado é o "Limpeza e Manutenção da Climatização".
  [/^pop (?!.*\b(climatizacao|ar condicionado)\b).*\b(gestao|manutencao|calibracao)\b.*\bequipamentos?\b.*$/, "pop gestao de equipamentos"],
  [/^planilha .*rastreabilidade.*$/, "planilha rastreabilidade de produtos"],
];

// Qualificam o procedimento sem mudar qual é ele ("Microagulhamento Facial").
const QUALIFICADORES = new Set(["facial", "corporal", "capilar", "intimo", "intima", "labial", "pele"]);

const REGIOES = new Set(["facial", "corporal", "capilar", "intimo", "intima", "labial"]);
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
  "glicemia",
  "microagulhamento",
  "peim",
  "podologia",
  "intradermoterapia",
  "nutricional",
  "farmaceutico",
  "prp",
  "tens",
  "hifu",
  "hiperpigmentacao",
  "power",
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
  // O nome todo dentro do template: quanto menos sobra no template, mais é ele.
  const sobraNoTemplate = candTokens.filter((token) => !docTokens.includes(token)).length;
  if (docPhrase.length >= 4 && candPhrase.includes(docPhrase)) score = Math.max(score, 88 - 2 * sobraNoTemplate);

  const contiguous = longestContiguousOverlap(docTokens, candTokens);
  if (contiguous >= 2) score += Math.min(12, contiguous * 3);

  const distinctiveMatches = candTokens.filter(
    (token) => token.length >= 5 && docTokens.includes(token)
  ).length;
  score += Math.min(10, distinctiveMatches * 2);

  // Tirando facial/corporal/capilar, o que sobra do nome está todo no template:
  // "TCLE - Microagulhamento Facial" é o TCLE de microagulhamento.
  const nucleo = docTokens.filter((token) => !QUALIFICADORES.has(token));
  // Com uma palavra só ("Avaliação Facial e Corporal"), o template não pode ter
  // outra que mude o assunto ("Avaliação por Bioimpedância").
  const sobraQueMudaOAssunto = candTokens.filter(
    (token) => !docTokens.includes(token) && !QUALIFICADORES.has(token)
  ).length;
  const regiaoDoc = docTokens.filter((token) => REGIOES.has(token));
  const regiaoTemplate = candTokens.filter((token) => REGIOES.has(token));
  if (
    nucleo.length > 0 &&
    nucleo.every((token) => candTokens.includes(token)) &&
    (nucleo.length >= 2 ||
      sobraQueMudaOAssunto === 0 ||
      PRIORITY_TOKENS.has(nucleo[0]) ||
      regiaoDoc.some((token) => regiaoTemplate.includes(token)))
  ) {
    score = Math.max(score, 70 + Math.round(diceScore(docTokens, candTokens) * 20) - 3 * sobraNoTemplate);
  }
  // Só "facial e corporal" em comum não faz "Avaliação Facial e Corporal" virar
  // "Drenagem Facial e Corporal".
  // Já "Estética Íntima" é só a região mesmo, e vale para "Estética Íntima Não Cirúrgica".
  const assuntoDoTemplate = candTokens.filter((token) => !QUALIFICADORES.has(token));
  if (
    nucleo.length > 0 &&
    assuntoDoTemplate.length > 0 &&
    !nucleo.some((token) => candTokens.includes(token))
  ) {
    score = Math.min(score, 40);
  }
  // "Avaliação Facial e Corporal" não é a "Avaliação Capilar".
  if (regiaoDoc.length > 0 && regiaoTemplate.length > 0 && !regiaoTemplate.some((token) => regiaoDoc.includes(token))) {
    score = Math.min(score, 50);
  }

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

/**
 * O nome como veio e versões limpas dele: sem as anotações do planejamento
 * ("(Contempla IV.29)", "(personalizar ...)", ": Documento formal ...") e com os
 * APELIDOS trocados pelo nome do acervo. Vale a que der a melhor nota.
 */
function variantesDoNome(docName: string): Array<{ nome: string; desconto: number }> {
  const semParenteses = docName.replace(/\([^)]*\)/g, " ");
  // O que vem entre parênteses costuma ser equipamento ou detalhe ("Pós-Operatório
  // (Fotobiomodulação; Bota compressiva)"): ajuda a achar, mas vale um pouco menos
  // que o nome em si.
  const desconto = semParenteses === docName ? 0 : 6;
  const variantes = new Map<string, number>([[docName, desconto]]);
  variantes.set(semParenteses, 0);

  const doisPontos = semParenteses.indexOf(":");
  if (doisPontos > 0 && tokenize(semParenteses.slice(0, doisPontos)).length >= 2) {
    variantes.set(semParenteses.slice(0, doisPontos), 0);
  }

  for (const [variante, descontoDaVariante] of Array.from(variantes)) {
    let trocado = normalize(variante);
    for (const [padrao, nomeNoAcervo] of APELIDOS) trocado = trocado.replace(padrao, nomeNoAcervo);
    if (!variantes.has(trocado)) variantes.set(trocado, descontoDaVariante);
  }
  return Array.from(variantes, ([nome, descontoDaVariante]) => ({ nome, desconto: descontoDaVariante }));
}

// TCLE é um termo: "Termo de Autorização de Uso de Imagem" pode ser o "TCLE - Uso de Imagem".
function tiposCompativeis(esperado: string, doTemplate: string): boolean {
  if (esperado === doTemplate) return true;
  return (esperado === "termo" && doTemplate === "tcle") || (esperado === "tcle" && doTemplate === "termo");
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
  const variantes = variantesDoNome(docName);

  for (const template of templates) {
    const templateType = normalize(template.tipo);
    const templateNameTokens = new Set(tokenize(template.nome, true));
    if (
      expectedType &&
      expectedType !== "psp" &&
      !tiposCompativeis(expectedType, templateType)
    ) {
      continue;
    }
    if (expectedType === "psp" && !templateNameTokens.has("psp")) continue;

    const baseCandidates = [template.nome, templateFileName(template)];
    if (["mbp", "pgrss"].includes(templateType)) baseCandidates.push(template.tipo);
    const nameCandidates = baseCandidates.flatMap(expandedCandidates);
    const nameScore = Math.max(
      ...variantes.flatMap((variante) =>
        nameCandidates.map((candidate) => scoreCandidate(variante.nome, candidate) - variante.desconto)
      )
    );
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
