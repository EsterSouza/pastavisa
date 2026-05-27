import PizZip from "pizzip";
import { isSupportedTemplateVariable } from "./template-variables";

export type TemplateValidationLevel = "error" | "warning" | "info";

export interface TemplateValidationIssue {
  level: TemplateValidationLevel;
  message: string;
}

export interface TemplateConditionalUse {
  key: string;
  valid: boolean;
}

export interface TemplateValidationReport {
  variaveis: string[];
  variaveisReconhecidas: string[];
  variaveisDesconhecidas: string[];
  condicionais: TemplateConditionalUse[];
  blocosIa: number;
  issues: TemplateValidationIssue[];
  valid: boolean;
}

const XML_FILES = [
  "word/document.xml",
  "word/header1.xml",
  "word/header2.xml",
  "word/header3.xml",
  "word/footer1.xml",
  "word/footer2.xml",
];

function documentText(content: Buffer): string {
  const zip = new PizZip(content);
  return XML_FILES
    .map((file) => zip.files[file]?.asText() || "")
    .join("\n")
    .replace(/<[^>]+>/g, "");
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

export function validateTemplateBuffer(content: Buffer): TemplateValidationReport {
  const text = documentText(content);
  const variableKeys = new Set<string>();
  const conditionalOpen = Array.from(text.matchAll(/\{#([a-zA-Z_][a-zA-Z0-9_]*)\}/g)).map((match) => match[1]);
  const conditionalClose = Array.from(text.matchAll(/\{\/([a-zA-Z_][a-zA-Z0-9_]*)\}/g)).map((match) => match[1]);

  Array.from(text.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)).forEach((match) => {
    variableKeys.add(match[1]);
  });
  conditionalOpen.forEach((key) => variableKeys.add(key));

  const variaveis = Array.from(variableKeys).sort();
  const variaveisReconhecidas = variaveis.filter(isSupportedTemplateVariable);
  const variaveisDesconhecidas = variaveis.filter((key) => !isSupportedTemplateVariable(key));
  const conditionalKeys = Array.from(new Set([...conditionalOpen, ...conditionalClose])).sort();
  const condicionais = conditionalKeys.map((key) => ({
    key,
    valid:
      isSupportedTemplateVariable(key) &&
      conditionalOpen.filter((entry) => entry === key).length === conditionalClose.filter((entry) => entry === key).length,
  }));
  const starts = countMatches(text, /\[AI_ADAPT_START\]/g);
  const ends = countMatches(text, /\[AI_ADAPT_END\]/g);
  const issues: TemplateValidationIssue[] = [];

  variaveisDesconhecidas.forEach((key) => {
    issues.push({ level: "error", message: `Variável desconhecida: {${key}}.` });
  });

  condicionais.filter((entry) => !entry.valid).forEach((entry) => {
    issues.push({
      level: "error",
      message: `Condicional inválida ou sem fechamento correspondente: {#${entry.key}}...{/${entry.key}}.`,
    });
  });

  if (starts !== ends) {
    issues.push({
      level: "error",
      message: "Bloco de IA incompleto: cada [AI_ADAPT_START] precisa de um [AI_ADAPT_END].",
    });
  } else if (starts > 0) {
    issues.push({ level: "info", message: `${starts} bloco(s) de adaptação por IA detectado(s).` });
  }

  if (variaveis.length === 0 && starts === 0) {
    issues.push({
      level: "warning",
      message: "Nenhuma variável ou bloco de IA foi encontrado; este template será essencialmente fixo.",
    });
  }

  return {
    variaveis,
    variaveisReconhecidas,
    variaveisDesconhecidas,
    condicionais,
    blocosIa: Math.min(starts, ends),
    issues,
    valid: !issues.some((issue) => issue.level === "error"),
  };
}
