import { extractReferenceSection, type ReferenceScopeOptions } from "@/lib/reference-extractor";

export interface LegislacaoAssociavel {
  id: string;
  estadoUf: string;
  municipio?: string | null;
  tipo: string;
  titulo: string;
  referenciaAbnt: string;
  destaqueAbnt?: string | null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "o")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function instrumentKeys(value: string): Set<string> {
  const text = normalize(value);
  const patterns: Array<[string, RegExp]> = [
    ["RDC", /\bRDC\s*(?:N[O.]?\s*)?([\d.]{1,8})/g],
    ["LEI COMPLEMENTAR", /\bLEI\s+COMPLEMENTAR\s*(?:N[O.]?\s*)?([\d.]{1,8})/g],
    ["LEI", /\bLEI(?!\s+COMPLEMENTAR)\s*(?:N[O.]?\s*)?([\d.]{1,8})/g],
    ["DECRETO", /\bDECRETO(?:\s+MUNICIPAL|\s+RIO)?\s*(?:N[O.]?\s*)?([\d.]{1,8})/g],
    ["COFEN", /\bRESOLUCAO\s+COFEN\s*(?:N[O.]?\s*)?([\d.]{1,8})/g],
    ["RESOLUCAO SMS", /\bRESOLUCAO\s+SMS\s*(?:N[O.]?\s*)?([\d.]{1,8})/g],
    ["NR", /\bNR\s*[- ]?\s*(\d{1,3})\b/g],
    ["PORTARIA", /\bPORTARIA(?:\s+GM\/MS)?\s*(?:N[O.]?\s*)?([\d.]{1,8})/g],
    ["NOTA TECNICA", /\bNOTA\s+TECNICA\s*(?:N[O.]?\s*)?([\d.]{1,8})/g],
    ["PARECER", /\bPARECER(?:\s+NORMATIVO)?\s*(?:N[O.]?\s*)?([\d.]{1,8})/g],
  ];
  const keys = new Set<string>();
  patterns.forEach(([kind, pattern]) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      keys.add(`${kind}:${match[1].replace(/\D/g, "")}`);
    }
  });
  return keys;
}

function descriptiveTokens(value: string): string[] {
  const ignored = new Set([
    "BRASIL", "FEDERAL", "ESTADO", "MUNICIPIO", "SECRETARIA", "AGENCIA",
    "NACIONAL", "SAUDE", "RESOLUCAO", "DIRETORIA", "COLEGIADA", "MINISTERIO",
    "NUMERO", "ANVISA", "MANUAL", "CODIGO", "SANITARIO",
  ]);
  return normalize(value)
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(" ")
    .filter((token) => token.length >= 5 && !ignored.has(token));
}

export function associarLegislacoesDoDocumento(
  documentText: string,
  legislacoes: LegislacaoAssociavel[],
  options: ReferenceScopeOptions = {}
): LegislacaoAssociavel[] {
  const referenceText = extractReferenceSection(documentText) || documentText;
  const normalizedDocument = normalize(referenceText);
  const documentKeys = instrumentKeys(referenceText);
  const estadoCliente = options.estadoUf?.toUpperCase().trim();
  const municipioCliente = normalize(options.municipio || "");

  return legislacoes.filter((legislacao) => {
    const estadoLegislacao = legislacao.estadoUf?.toUpperCase().trim();
    if (estadoLegislacao && estadoLegislacao !== "BR") {
      if (estadoCliente && estadoLegislacao !== estadoCliente) return false;
      if (legislacao.municipio && municipioCliente && normalize(legislacao.municipio) !== municipioCliente) return false;
    }

    const keys = instrumentKeys(`${legislacao.titulo} ${legislacao.referenciaAbnt}`);
    let identifierMatched = false;
    keys.forEach((key) => {
      if (documentKeys.has(key)) identifierMatched = true;
    });
    if (identifierMatched) return true;

    const normalizedReference = normalize(legislacao.referenciaAbnt);
    if (normalizedReference.length > 30 && normalizedDocument.includes(normalizedReference)) return true;

    const tokens = descriptiveTokens(legislacao.titulo);
    const matchedTokens = tokens.filter((token) => normalizedDocument.includes(token));
    return tokens.length >= 3 && matchedTokens.length >= Math.min(4, tokens.length);
  });
}
