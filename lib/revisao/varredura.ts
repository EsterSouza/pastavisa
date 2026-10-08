import PizZip from "pizzip";
import { validateDocxBuffer } from "@/lib/docx-validator";
import { resolveTextParts } from "@/lib/docx-replacement-plan";
import { detectarReferenciasNaoCadastradas } from "@/lib/reference-extractor";
import type { ReferenciaComparavel } from "@/lib/reference-deduplication";

/**
 * Varredura sem modelo de um DOCX gerado (port de `varredura.py`, etapas 1 e 6
 * do pipeline de revisão). Aponta o que impede o Word de abrir o arquivo e os
 * sinais de texto genérico do template: variável que sobrou, travessão e
 * palavras que costumam indicar outra categoria, outra cliente ou serviço que a
 * cliente não oferece.
 */

export type TipoAlerta = "estrutura" | "variavel" | "travessao" | "termo" | "norma";

export interface AlertaVarredura {
  tipo: TipoAlerta;
  mensagem: string;
  trecho?: string;
}

export interface ResultadoVarredura {
  alertas: AlertaVarredura[];
  texto: string;
}

export interface OpcoesVarredura {
  /** Legislações cadastradas; quando informadas, aponta norma citada fora do cadastro. */
  legislacoes?: ReferenciaComparavel[];
  escopo?: { estadoUf?: string | null; municipio?: string | null };
}

/** Termos que costumam indicar texto genérico do template. Edite à vontade. */
export const ALERTAS = [
  "cliente", "clínica", "consultório", "equipe", "demais profissionais", "designada", "Dra.",
  "laser", "luz intensa", "alta frequência", "autoclave", "esteriliz", "expurgo", "farmác",
  "COFEN", "CFBM", "COFFITO", "soroterapia", "endoven", "ISENTO", "Grupo B",
  "caso exista", "quando aplicável", "a preencher", "insumo; Injetável", "Materiais vinculados",
];

const TRAVESSOES = ["—", "–"];
const JANELA = 50;

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Texto visível de um trecho de XML (todos os `<w:t>` concatenados). */
export function ptext(xml: string): string {
  return decodeXml(Array.from(xml.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g), (m) => m[1]).join(""));
}

/** Texto de uma parte do DOCX, um parágrafo por linha. */
export function textoDaParte(xml: string): string {
  const normalizado = xml.replace(/<w:p(?=[\s>/])([^>]*)\/>/g, "<w:p$1></w:p>");
  return Array.from(normalizado.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g), (m) => ptext(m[0])).join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trechoEm(texto: string, inicio: number, fim: number): string {
  return texto
    .slice(Math.max(0, inicio - JANELA), fim + JANELA)
    .replace(/\s+/g, " ")
    .trim();
}

function duplicados(valores: string[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const v of valores) (vistos.has(v) ? repetidos : vistos).add(v);
  return Array.from(repetidos);
}

function alertasDeEstrutura(buffer: Buffer, zip: PizZip): AlertaVarredura[] {
  const alertas: AlertaVarredura[] = validateDocxBuffer(buffer).issues.map((issue) => ({
    tipo: "estrutura",
    mensagem: `${issue.file}: ${issue.message}`,
  }));

  for (const nome of Object.keys(zip.files)) {
    if (!nome.endsWith(".rels")) continue;
    const ids = Array.from(zip.files[nome].asText().matchAll(/\bId="([^"]+)"/g), (m) => m[1]);
    const dup = duplicados(ids);
    if (dup.length) alertas.push({ tipo: "estrutura", mensagem: `rId duplicado em ${nome}: ${dup.join(", ")}` });
  }

  const numbering = zip.files["word/numbering.xml"];
  if (numbering) {
    const ids = Array.from(numbering.asText().matchAll(/<w:num w:numId="(\d+)"/g), (m) => m[1]);
    const dup = duplicados(ids);
    if (dup.length) alertas.push({ tipo: "estrutura", mensagem: `numId duplicado: ${dup.join(", ")}` });
  }

  return alertas;
}

export function varrerDocx(buffer: Buffer, opcoes: OpcoesVarredura = {}): ResultadoVarredura {
  let zip: PizZip;
  try {
    zip = new PizZip(buffer);
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "ZIP inválido";
    return { alertas: [{ tipo: "estrutura", mensagem: `Arquivo não abre: ${mensagem}` }], texto: "" };
  }

  const alertas = alertasDeEstrutura(buffer, zip);
  const texto = resolveTextParts(zip)
    .map((parte) => {
      try {
        return textoDaParte(zip.files[parte].asText());
      } catch {
        return "";
      }
    })
    .join("\n");

  const variaveis = Array.from(new Set(Array.from(texto.matchAll(/\{[^}\n]{1,60}\}/g), (m) => m[0])));
  if (variaveis.length) {
    alertas.push({ tipo: "variavel", mensagem: `Variável não substituída: ${variaveis.sort().join(", ")}` });
  }

  for (const t of TRAVESSOES) {
    const i = texto.indexOf(t);
    if (i < 0) continue;
    const vezes = texto.split(t).length - 1;
    alertas.push({ tipo: "travessao", mensagem: `Travessão (${t}) ${vezes} vez(es)`, trecho: trechoEm(texto, i, i + 1) });
  }

  // Variável já foi apontada acima; sem isto "{cliente_nome}" contaria como o termo "cliente".
  const textoSemVariaveis = texto.replace(/\{[^}\n]{1,60}\}/g, (v) => " ".repeat(v.length));
  for (const termo of ALERTAS) {
    // Sigla em maiúsculas casa só em maiúsculas; o resto ignora caixa.
    const flags = termo === termo.toUpperCase() ? "g" : "gi";
    const ocorrencias = Array.from(textoSemVariaveis.matchAll(new RegExp(escapeRegExp(termo), flags)));
    if (!ocorrencias.length) continue;
    const primeira = ocorrencias[0];
    alertas.push({
      tipo: "termo",
      mensagem: `"${termo}" ${ocorrencias.length}x`,
      trecho: trechoEm(texto, primeira.index!, primeira.index! + primeira[0].length),
    });
  }

  if (opcoes.legislacoes) {
    for (const ref of detectarReferenciasNaoCadastradas(texto, opcoes.legislacoes, opcoes.escopo)) {
      alertas.push({ tipo: "norma", mensagem: "Norma citada fora do cadastro de legislações", trecho: ref.referenciaAbnt });
    }
  }

  return { alertas, texto };
}
