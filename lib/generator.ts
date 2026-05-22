import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { ClienteData, detectBlockType, processAdaptBlock } from "./ai";
import { replaceLogo, injectLogoVariable } from "./logo-replacer";
import { textToOoxmlParagraphs, sanitizeXmlFromMarkdown } from "./text-to-ooxml";
import { ProcessingType, modelForType } from "./classifier";
import { assertValidDocxBuffer } from "./docx-validator";
import { resolveProjectPath } from "./storage-paths";
import { materializeStorageFile, readStorageBuffer, saveGeneratedDocx } from "./file-storage";

// ─── Date helpers ──────────────────────────────────────────────────────────────

const MESES_PT = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
];

/**
 * Preposição correta de acordo com o gênero do nome do estado.
 * Usado pela variável {cliente_estado_preposicao} nos templates.
 * Exemplo: "Estado de Santa Catarina" (SC → "de"), "Estado do Pará" (PA → "do").
 */
const ESTADO_PREPOSICAO: Record<string, string> = {
  AC: "do", AL: "de", AP: "do", AM: "do", BA: "da",
  CE: "do", DF: "do", ES: "do", GO: "de", MA: "do",
  MT: "do", MS: "do", MG: "de", PA: "do", PB: "da",
  PR: "do", PE: "de", PI: "do", RJ: "do", RN: "do",
  RS: "do", RO: "de", RR: "de", SC: "de", SP: "de",
  SE: "de", TO: "do",
};

function getEmissao(date?: Date): string {
  const d = date || new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function addMonths(base: string, months: number): string {
  const [mm, yyyy] = base.split("/").map(Number);
  const d = new Date(yyyy, mm - 1 + months, 1);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function getMesExtenso(date?: Date): string {
  const d = date || new Date();
  return MESES_PT[d.getMonth()];
}

function getAno(date?: Date): string {
  const d = date || new Date();
  return String(d.getFullYear());
}

function buildElaborador(nomeFantasia?: string): string {
  if (!nomeFantasia) return "";
  const parts = nomeFantasia.trim().split(/\s+/);
  return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : nomeFantasia;
}

function buildServicosList(servicos?: string[]): string {
  if (!servicos || servicos.length === 0) return "Não informado";
  return servicos.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

function buildFuncionariosList(
  funcionarios?: Array<{ nome: string; funcao: string; conselho: string }>
): string {
  if (!funcionarios || funcionarios.length === 0) return "Não informado";
  return funcionarios
    .map((f, i) => {
      const partes = [f.nome, f.funcao, f.conselho].map((p) => p?.trim()).filter(Boolean);
      return `${i + 1}. ${partes.join(" | ")}`;
    })
    .join("\n");
}

function buildEquipamentosList(
  equips?: Array<{ nome: string; marca: string; modelo: string; registro_anvisa: string }>
): string {
  if (!equips || equips.length === 0) return "Não informado";
  return equips.map((e) => `${e.nome} — ${e.marca} ${e.modelo} (ANVISA: ${e.registro_anvisa})`).join("\n");
}

function buildProdutosInsumosList(
  itens?: Array<{ nome: string; categoria: string; fabricante: string; registro_anvisa: string; uso: string }>
): string {
  if (!itens || itens.length === 0) return "Nao informado";
  return itens
    .filter((item) => item.nome?.trim() || item.categoria?.trim() || item.fabricante?.trim() || item.registro_anvisa?.trim() || item.uso?.trim())
    .map((item, index) => {
      const detalhes = [
        item.categoria?.trim(),
        item.fabricante?.trim() ? `fabricante ${item.fabricante.trim()}` : "",
        item.registro_anvisa?.trim() ? `registro ANVISA ${item.registro_anvisa.trim()}` : "",
        item.uso?.trim() ? `uso: ${item.uso.trim()}` : "",
      ].filter(Boolean);
      return `${index + 1}. ${item.nome?.trim() || "Item"}${detalhes.length ? ` | ${detalhes.join(" | ")}` : ""}`;
    })
    .join("\n");
}

export interface EquipamentoDocumento {
  nome?: string | null;
  marca?: string | null;
  modelo?: string | null;
  registro_anvisa?: string | null;
}

function normalizeTextForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function paragraphPlainText(paraXml: string): string {
  return paraXml
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function formatEquipamentoForMaterialSection(eq: EquipamentoDocumento): string {
  const nome = eq.nome?.trim();
  const marca = eq.marca?.trim();
  const modelo = eq.modelo?.trim();
  const registro = eq.registro_anvisa?.trim();
  const detalhes = [
    marca ? `marca ${marca}` : "",
    modelo ? `modelo ${modelo}` : "",
    registro ? `registro ANVISA ${registro}` : "",
  ].filter(Boolean);

  return detalhes.length > 0
    ? `${nome || "Equipamento"} (${detalhes.join("; ")})`
    : (nome || "Equipamento");
}

function buildEquipamentosPopText(equipamentos: EquipamentoDocumento[]): string {
  const linhas = equipamentos
    .filter((eq) => eq.nome?.trim() || eq.marca?.trim() || eq.modelo?.trim() || eq.registro_anvisa?.trim())
    .map((eq) => `- ${formatEquipamentoForMaterialSection(eq)}`);

  if (linhas.length === 0) return "";
  return ["Equipamentos vinculados ao procedimento:", ...linhas].join("\n");
}

function shouldInjectEquipamentosNoPop(options: GeneratorOptions): boolean {
  const tipo = normalizeTextForSearch(options.documentoTipo || "");
  const nome = normalizeTextForSearch(options.documentoNome || "");
  return tipo === "POP" || nome.startsWith("POP ") || nome.includes(" POP ");
}

function injectEquipamentosIntoMaterialsSection(
  xmlContent: string,
  equipamentos: EquipamentoDocumento[]
): { xml: string; inserted: boolean } {
  const insertionText = buildEquipamentosPopText(equipamentos);
  if (!insertionText) return { xml: xmlContent, inserted: false };

  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
  const paraMatches = Array.from(xmlContent.matchAll(paraRegex));
  const headingPatterns = [
    "MATERIAIS NECESSARIOS",
    "MATERIAIS E EQUIPAMENTOS",
    "MATERIAL NECESSARIO",
    "MATERIAL E EQUIPAMENTO",
  ];

  for (const match of paraMatches) {
    const paraXml = match[0];
    const normalized = normalizeTextForSearch(paragraphPlainText(paraXml));
    const isHeading = headingPatterns.some((pattern) => normalized.includes(pattern));
    if (!isHeading) continue;

    const insertAt = (match.index || 0) + paraXml.length;
    const insertionXml = textToOoxmlParagraphs(insertionText, paraXml);
    return {
      xml: xmlContent.slice(0, insertAt) + insertionXml + xmlContent.slice(insertAt),
      inserted: true,
    };
  }

  return { xml: xmlContent, inserted: false };
}

function buildTerceirizadosList(
  terc?: Array<{ servico: string; razao_social: string; cnpj: string }>
): string {
  if (!terc || terc.length === 0) return "Não informado";
  return terc.map((t) => `${t.servico}: ${t.razao_social} | CNPJ: ${t.cnpj}`).join("\n");
}

/**
 * If the residue quantity is just a bare number (e.g. "1", "0,5", "10"),
 * format as "aproximadamente N kg/mês".  Otherwise return as-is.
 */
function formatResiduoQuantidade(v?: string): string {
  if (!v) return "[a preencher]";
  const trimmed = v.trim();
  if (trimmed === "") return "[a preencher]";
  // Bare number with optional decimal/comma
  if (/^\d+([.,]\d+)?$/.test(trimmed)) {
    return `aproximadamente ${trimmed} kg/mês`;
  }
  return trimmed;
}

/**
 * Builds an OOXML <w:tbl> from a JSON describing headers + rows.
 * Used by the "table" AI_ADAPT block type.
 *
 * @param json    The JSON string returned by the AI: {"headers":[...], "rows":[[...]]}
 * @param origPara The original paragraph XML, used to inherit run/paragraph styles
 */
export function tableJsonToOoxml(json: string, origPara: string): string {
  let parsed: { headers?: string[]; rows?: string[][] };
  try {
    // Strip code fences if any
    const cleaned = json.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return ""; // caller will fall back to stripping markers
  }
  const headers = Array.isArray(parsed.headers) ? parsed.headers : [];
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  if (headers.length === 0) return "";

  const xmlEscape = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\{/g, "[")
      .replace(/\}/g, "]");

  // Inherit run properties from the original paragraph for font consistency
  const rPrMatch = origPara.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  const rPrInner = rPrMatch ? rPrMatch[1] : "";
  const rPr = rPrInner ? `<w:rPr>${rPrInner}</w:rPr>` : "";

  const totalCols = headers.length;
  // Equal column width — total table width 9000 twips (about 16 cm)
  const colWidth = Math.floor(9000 / totalCols);

  const buildCell = (text: string, bold: boolean): string => {
    const boldRpr = bold
      ? `<w:rPr>${rPrInner}<w:b/></w:rPr>`
      : rPr;
    return (
      `<w:tc>` +
      `<w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/>` +
      `<w:tcBorders>` +
      `<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
      `<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
      `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
      `<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
      `</w:tcBorders>` +
      `</w:tcPr>` +
      `<w:p><w:r>${boldRpr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>` +
      `</w:tc>`
    );
  };

  const buildRow = (cells: string[], bold: boolean): string => {
    // Pad/truncate cells to match header count
    const padded = cells.slice(0, totalCols);
    while (padded.length < totalCols) padded.push("");
    return `<w:tr>${padded.map((c) => buildCell(c, bold)).join("")}</w:tr>`;
  };

  const grid = headers
    .map(() => `<w:gridCol w:w="${colWidth}"/>`)
    .join("");

  return (
    `<w:tbl>` +
    `<w:tblPr>` +
    `<w:tblW w:w="9000" w:type="dxa"/>` +
    `<w:tblLayout w:type="fixed"/>` +
    `</w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>` +
    buildRow(headers, true) +
    rows.map((r) => buildRow(r, false)).join("") +
    `</w:tbl>` +
    `<w:p/>` // trailing empty paragraph required after a table in body
  );
}

// ─── AI_ADAPT XML helpers ─────────────────────────────────────────────────────

/**
 * Returns true if a paragraph has no visible text content.
 * Used to absorb empty spacer paragraphs surrounding AI_ADAPT blocks,
 * which would otherwise create blank lines before/after the generated text.
 */
function isEmptyParagraph(paraXml: string): boolean {
  // A paragraph with no <w:t element has no text → visually empty.
  // We also skip paragraphs that contain inline images or VML shapes.
  return (
    !/<w:t/.test(paraXml) &&
    !/<w:drawing/.test(paraXml) &&
    !/<w:pict/.test(paraXml)
  );
}

/**
 * Finds the first AI_ADAPT block in the document XML and returns the boundaries
 * + the original paragraph XML (for style inheritance).
 *
 * Detection always uses plain text (tags stripped) so split-run markers
 * are found reliably. Replacement uses character offsets into the XML string.
 *
 * INLINE MODE: When both [AI_ADAPT_START] and [AI_ADAPT_END] are inside the
 * same <w:p> element AND the paragraph also contains other text (before/after
 * the markers), the block is flagged as inline.  In this mode the caller must
 * prepend inlinePrefix and append inlineSuffix to the replacement text so the
 * surrounding sentence is preserved.  Empty-paragraph expansion is skipped for
 * inline blocks — we replace exactly the one paragraph that contains the block.
 *
 * BLOCK MODE (default): After locating the block the function expands startIdx
 * backwards and endIdx forwards to absorb any immediately adjacent empty
 * paragraphs. This prevents the blank-line artefacts that appear when the
 * template author placed spacing paragraphs around the AI_ADAPT markers.
 */
function locateFirstAdaptBlock(xmlContent: string): {
  startIdx: number;
  endIdx: number;
  originalParaXml: string;
  isInline: boolean;
  inlinePrefix: string;
  inlineSuffix: string;
} | null {
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
  const paraMatches = Array.from(xmlContent.matchAll(paraRegex));

  let accumulated = "";
  let startArrIdx = -1;
  let endArrIdx = -1;
  let startIdx = -1;
  let endIdx = -1;
  let originalParaXml = "";

  for (let i = 0; i < paraMatches.length; i++) {
    const pm = paraMatches[i];
    const plain = pm[0].replace(/<[^>]+>/g, "");
    accumulated += plain;

    if (startArrIdx === -1 && accumulated.includes("[AI_ADAPT_START]")) {
      startArrIdx = i;
      startIdx = pm.index!;
      originalParaXml = pm[0];
    }
    if (startArrIdx !== -1 && accumulated.includes("[AI_ADAPT_END]")) {
      endArrIdx = i;
      endIdx = pm.index! + pm[0].length;
      break;
    }
  }

  if (startIdx === -1 || endIdx === -1) return null;

  // ── Detect inline context ─────────────────────────────────────────────────
  // A block has an "inline prefix" when the paragraph that contains
  // [AI_ADAPT_START] also has non-empty text BEFORE the marker.
  // A block has an "inline suffix" when the paragraph that contains
  // [AI_ADAPT_END] also has non-empty text AFTER the marker.
  //
  // This covers BOTH cases:
  //   A) Single-paragraph inline: "sentence text [AI_ADAPT_START]…[AI_ADAPT_END] more text"
  //   B) Multi-paragraph block where the first paragraph has a sentence prefix:
  //      "sentence text [AI_ADAPT_START]"  ← paragraph i
  //      "instruction line 2"               ← paragraph i+1
  //      "[AI_ADAPT_END]."                  ← paragraph i+k
  //
  // When inline, we do NOT expand to absorb adjacent empty paragraphs —
  // that would eat actual sentence content.
  let isInline = false;
  let inlinePrefix = "";
  let inlineSuffix = "";

  // Check START paragraph for prefix text
  const startParaPlain = paraMatches[startArrIdx][0].replace(/<[^>]+>/g, "");
  if (startParaPlain.includes("[AI_ADAPT_START]")) {
    const msStart = startParaPlain.indexOf("[AI_ADAPT_START]");
    const prefix  = startParaPlain.substring(0, msStart);
    if (prefix.trim().length > 0) {
      inlinePrefix = prefix;
      isInline = true;
    }
  }

  // Check END paragraph for suffix text
  const endParaPlain = paraMatches[endArrIdx][0].replace(/<[^>]+>/g, "");
  if (endParaPlain.includes("[AI_ADAPT_END]")) {
    const msEnd  = endParaPlain.indexOf("[AI_ADAPT_END]") + "[AI_ADAPT_END]".length;
    const suffix = endParaPlain.substring(msEnd);
    if (suffix.trim().length > 0) {
      inlineSuffix = suffix;
      isInline = true;
    }
  }

  if (!isInline) {
    // ── Expand backwards: absorb empty paragraphs immediately before the block.
    for (let i = startArrIdx - 1; i >= 0; i--) {
      if (isEmptyParagraph(paraMatches[i][0])) {
        startIdx = paraMatches[i].index!;
      } else {
        break;
      }
    }

    // ── Expand forwards: absorb empty paragraphs immediately after the block.
    for (let i = endArrIdx + 1; i < paraMatches.length; i++) {
      if (isEmptyParagraph(paraMatches[i][0])) {
        endIdx = paraMatches[i].index! + paraMatches[i][0].length;
      } else {
        break;
      }
    }
  }

  return { startIdx, endIdx, originalParaXml, isInline, inlinePrefix, inlineSuffix };
}

function replaceFirstAdaptBlockInXml(
  xmlContent: string,
  replacementText: string
): string {
  const loc = locateFirstAdaptBlock(xmlContent);
  if (!loc) {
    return xmlContent
      .replace(/\[AI_ADAPT_START\]/g, "")
      .replace(/\[AI_ADAPT_END\]/g, "");
  }
  // For inline blocks: reconstruct the sentence by prepending the text that
  // appeared before [AI_ADAPT_START] and appending the text after [AI_ADAPT_END].
  // This preserves the surrounding sentence context that the current code was dropping.
  const combined = loc.isInline
    ? (loc.inlinePrefix + replacementText + loc.inlineSuffix).trim()
    : replacementText;
  const ooxml = textToOoxmlParagraphs(combined, loc.originalParaXml);
  return xmlContent.slice(0, loc.startIdx) + ooxml + xmlContent.slice(loc.endIdx);
}

/**
 * Replaces the first AI_ADAPT block with arbitrary pre-built OOXML
 * (e.g. a <w:tbl> for table blocks).
 */
function replaceFirstAdaptBlockWithOoxml(
  xmlContent: string,
  ooxml: string
): { xml: string; originalParaXml: string } {
  const loc = locateFirstAdaptBlock(xmlContent);
  if (!loc) {
    return {
      xml: xmlContent
        .replace(/\[AI_ADAPT_START\]/g, "")
        .replace(/\[AI_ADAPT_END\]/g, ""),
      originalParaXml: "",
    };
  }
  return {
    xml: xmlContent.slice(0, loc.startIdx) + ooxml + xmlContent.slice(loc.endIdx),
    originalParaXml: loc.originalParaXml,
  };
}

// ─── RT body check ────────────────────────────────────────────────────────────

/**
 * Checks if {cliente_rt_nome} appears in the document body (not just header/footer).
 * Used to flag documents that need manual RT review.
 */
export async function hasRtInBody(templatePath: string): Promise<boolean> {
  try {
    const content = await readStorageBuffer(templatePath);
    const zip = new PizZip(content);
    const docXml = zip.files["word/document.xml"]?.asText() || "";
    // Strip XML tags and check for the variable
    const text = docXml.replace(/<[^>]+>/g, "");
    return text.includes("{cliente_rt_nome}");
  } catch {
    return false;
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

export interface LegislacoesTexto {
  federal: string;
  estadual: string;
  municipal: string;
}

export interface GeneratorOptions {
  processingType?: ProcessingType;
  logoPath?: string | null;
  criadaEm?: Date;
  documentosListados?: string;
  docElaborador?: string;
  docMesExtenso?: string;
  docAno?: string;
  legislacoesTexto?: LegislacoesTexto;
  documentoTipo?: string | null;
  documentoNome?: string;
  equipamentosDoPop?: EquipamentoDocumento[];
}

const DOCX_EXTENSION = ".DOCX";
const MAX_DOCX_FILENAME_LENGTH = 120;
const RESERVED_WINDOWS_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

function truncateFileBaseName(name: string, maxLength: number): string {
  if (Array.from(name).length <= maxLength) return name;

  const sliced = Array.from(name).slice(0, maxLength).join("").trim();
  const withoutTrailingPunctuation = sliced.replace(/[ ._-]+$/g, "");
  const lastSpace = withoutTrailingPunctuation.lastIndexOf(" ");

  if (lastSpace >= Math.floor(maxLength * 0.65)) {
    return withoutTrailingPunctuation.slice(0, lastSpace).trim();
  }

  return withoutTrailingPunctuation || sliced.slice(0, maxLength).trim();
}

export function createOutputDocxFileName(
  rawName: string,
  usedNames: Set<string> = new Set()
): string {
  const parsed = path.parse(rawName || "");
  const sourceName = parsed.ext.toLowerCase() === ".docx" ? parsed.name : rawName;
  const normalized = sourceName
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[ .]+$/g, "")
    .toLocaleUpperCase("pt-BR");

  let baseName = normalized || "DOCUMENTO";
  if (RESERVED_WINDOWS_NAMES.has(baseName)) {
    baseName = `${baseName} DOCUMENTO`;
  }

  const maxBaseLength = MAX_DOCX_FILENAME_LENGTH - DOCX_EXTENSION.length;
  baseName = truncateFileBaseName(baseName, maxBaseLength) || "DOCUMENTO";

  let candidate = `${baseName}${DOCX_EXTENSION}`;
  let counter = 2;

  while (usedNames.has(candidate.toLocaleUpperCase("pt-BR"))) {
    const suffix = ` (${counter})`;
    const baseWithSuffix = truncateFileBaseName(
      baseName,
      maxBaseLength - suffix.length
    );
    candidate = `${baseWithSuffix}${suffix}${DOCX_EXTENSION}`;
    counter += 1;
  }

  return candidate;
}

export async function gerarDocumento(
  templatePath: string,
  outputDir: string,
  nomeArquivo: string,
  clienteData: ClienteData,
  options: GeneratorOptions = {},
  onProgress?: (msg: string) => void
): Promise<{ outputPath: string; tokensTotal: number; logoSubstituida: boolean }> {
  const resolvedTemplatePath = resolveProjectPath(templatePath);
  const content = await readStorageBuffer(resolvedTemplatePath);
  const zip = new PizZip(content);

  const emissaoDate = options.criadaEm || new Date();
  const emissao = getEmissao(emissaoDate);

  // Build variable map
  const variaveis: Record<string, string> = {
    cliente_nome_fantasia: clienteData.clienteNomeFantasia || "",
    cliente_nome_fantasia_upper: (clienteData.clienteNomeFantasia || "").toUpperCase(),
    cliente_razao_social: clienteData.clienteRazaoSocial || "",
    cliente_razao_social_upper: (clienteData.clienteRazaoSocial || "").toUpperCase(),
    cliente_cnpj: clienteData.clienteCnpj || "",
    cliente_endereco: clienteData.clienteEndereco || "",
    cliente_cidade: clienteData.clienteCidade || "",
    cliente_estado: clienteData.clienteEstado || "",
    cliente_estado_extenso: clienteData.clienteEstadoExtenso || "",
    cliente_telefone: clienteData.clienteTelefone || "",
    cliente_email: clienteData.clienteEmail || "",
    cliente_horario: clienteData.clienteHorario || "",
    cliente_rt_nome: clienteData.clienteRtNome || "",
    cliente_rt_nome_upper: (clienteData.clienteRtNome || "").toUpperCase(),
    cliente_rt_profissao: clienteData.clienteRtProfissao || "",
    // Empty string when not filled — prevents AI from writing "não possui conselho"
    cliente_rt_conselho: clienteData.clienteRtConselho || "",
    cliente_estrutura_fisica: clienteData.clienteEstrutura || "",
    cliente_memorial_descritivo_mbp: clienteData.clienteMemorialDescritivoMbp || "",
    cliente_servicos_lista: buildServicosList(clienteData.clienteServicos),
    cliente_funcionarios_lista: buildFuncionariosList(clienteData.clienteFuncionarios),
    cliente_equipamentos_lista: buildEquipamentosList(clienteData.clienteEquipamentos),
    cliente_produtos_insumos_lista: buildProdutosInsumosList(clienteData.clienteProdutosInsumos),
    cliente_terceirizados: buildTerceirizadosList(clienteData.clienteTerceirizados),
    cliente_coleta_razao_social: clienteData.clienteColetaRazao || "",
    cliente_coleta_cnpj: clienteData.clienteColetaCnpj || "",
    cliente_residuos_grupo_a: formatResiduoQuantidade(clienteData.clienteResiduosA),
    cliente_residuos_grupo_d: formatResiduoQuantidade(clienteData.clienteResiduosD),
    cliente_residuos_grupo_e: formatResiduoQuantidade(clienteData.clienteResiduosE),
    doc_emissao: emissao,
    doc_revisao_1ano: addMonths(emissao, 12),
    doc_revisao_2anos: addMonths(emissao, 24),
    doc_versao: "1",
    doc_elaborador: options.docElaborador || buildElaborador(clienteData.clienteNomeFantasia),
    doc_mes_extenso: options.docMesExtenso || getMesExtenso(emissaoDate),
    doc_ano: options.docAno || getAno(emissaoDate),
    documentos_a_gerar: options.documentosListados || "",
    // Equipment-specific (extracted or empty)
    equipamento_dermografo_modelo: clienteData.clienteEquipamentos?.find(
      (e) => e.nome?.toLowerCase().includes("derm")
    )?.modelo || "",
    equipamento_dermografo_anvisa: clienteData.clienteEquipamentos?.find(
      (e) => e.nome?.toLowerCase().includes("derm")
    )?.registro_anvisa || "",
    autoclave_modelo: clienteData.clienteEquipamentos?.find(
      (e) => e.nome?.toLowerCase().includes("autoclave")
    )?.modelo || "",
    autoclave_anvisa: clienteData.clienteEquipamentos?.find(
      (e) => e.nome?.toLowerCase().includes("autoclave")
    )?.registro_anvisa || "",
    pigmento_marilyn_anvisa: "",
    agulha_anvisa: "",
    texto_legislacao_federal: options.legislacoesTexto?.federal || "",
    texto_legislacao_estadual: options.legislacoesTexto?.estadual || "",
    texto_legislacao_municipal: options.legislacoesTexto?.municipal || "",
    // Preposição correta para o estado (ex: SC → "de", PA → "do", BA → "da")
    // Usar em templates: "Estado {cliente_estado_preposicao} {cliente_estado_extenso}"
    cliente_estado_preposicao:
      ESTADO_PREPOSICAO[(clienteData.clienteEstado || "").toUpperCase()] || "do",
    // Booleano para condicionais docxtemplater:
    // {#cliente_tem_conselho}...{/cliente_tem_conselho} — oculta bloco quando vazio
    cliente_tem_conselho: clienteData.clienteRtConselho ? "true" : "",
    // Fallback: if injectLogoVariable didn't inject an image (no logo provided),
    // docxtemplater replaces {cliente_logo} with an empty string safely.
    cliente_logo: "",
    // Legacy aliases found in older templates.
    CLIENTE_NOME_FANTASIA_UPPER: (clienteData.clienteNomeFantasia || "").toUpperCase(),
  };

  let tokensTotal = 0;
  const processingType = options.processingType || "LIGHT_HAIKU";

  // ── AI adaptation (skip for HEADER_ONLY) ─────────────────────────────────
  if (processingType !== "HEADER_ONLY") {
    const docXmlFile = "word/document.xml";
    try {
      const modelo = modelForType(processingType);

      // Process blocks one at a time. Each iteration:
      //  1. Read current XML from the zip (updated by the previous iteration).
      //  2. Strip tags → plain text for reliable marker detection.
      //  3. Extract the first AI_ADAPT block found.
      //  4. Resolve {variables} inside the block before sending to AI.
      //  5. Detect block type and call AI.
      //  6. Replace the block in the XML and write back to the zip.
      // Repeat until no more blocks remain.

      let safetyCounter = 0;
      const MAX_BLOCKS = 50; // prevent infinite loop on malformed templates

      while (safetyCounter++ < MAX_BLOCKS) {
        const xmlContent = zip.files[docXmlFile]?.asText();
        if (!xmlContent) break;

        // Detect in plain text so split-run markers are found reliably
        const plainText = xmlContent.replace(/<[^>]+>/g, "");
        const blockMatch = /\[AI_ADAPT_START\]([\s\S]*?)\[AI_ADAPT_END\]/.exec(plainText);
        if (!blockMatch) break; // no more blocks

        // Resolve {variables} inside the instruction before handing to AI
        let instruction = blockMatch[1].replace(/\s+/g, " ").trim();
        for (const [k, v] of Object.entries(variaveis)) {
          instruction = instruction.replaceAll(`{${k}}`, v || "");
        }

        if (instruction.length < 5) {
          // Degenerate/empty block — remove the entire block (paragraphs + markers)
          // so no stray text leaks into the final document.
          zip.file(docXmlFile, replaceFirstAdaptBlockInXml(xmlContent, ""));
          continue;
        }

        const blockType = detectBlockType(instruction);
        const blockLabel =
          blockType === "instruction" ? "instrução"
          : blockType === "table" ? "tabela"
          : "adaptação";
        onProgress?.(`Bloco IA ${safetyCounter} — ${blockLabel}…`);

        try {
          const { texto, tokensUsados } = await processAdaptBlock(
            instruction,
            clienteData,
            blockType,
            modelo
          );
          tokensTotal += tokensUsados;

          // ── "No additional content" sentinel + AI refusal detection ─────────
          // 1. Specific sentinel phrases the AI returns when there's nothing to add.
          // 2. AI refusal / "cannot execute" phrases — these must NEVER appear in
          //    the document body.  When detected, remove the block entirely.
          const textoTrimmed = texto.trim();
          const isNoContentSignal =
            /^\((sem\s+siglas\s+adicionais|sem\s+referências\s+adicionais|sem\s+conteúdo)\)$/i.test(
              textoTrimmed
            ) ||
            // AI refusal patterns (PT and EN)
            /não\s+(posso|consigo|é\s+possível)\s+(executar|realizar|gerar|criar|fazer)/i.test(textoTrimmed) ||
            /não\s+me\s+é\s+possível/i.test(textoTrimmed) ||
            /a\s+solicitação\s+pede\s+para\s+gerar/i.test(textoTrimmed) ||
            /desculpe[,\s]/i.test(textoTrimmed) ||
            /lamento[,\s]/i.test(textoTrimmed) ||
            /I\s+(cannot|can't|am\s+unable\s+to)\s+(execute|generate|create)/i.test(textoTrimmed) ||
            // Starts with a meta-commentary about the instruction itself
            /^(esta\s+instrução|a\s+instrução|o\s+bloco|este\s+bloco)\s+(não|pede|solicita|requer)/i.test(textoTrimmed);
          if (isNoContentSignal || textoTrimmed === "") {
            zip.file(docXmlFile, replaceFirstAdaptBlockInXml(xmlContent, ""));
            continue;
          }

          // Strip XML 1.0 invalid control characters from all AI output
          // eslint-disable-next-line no-control-regex
          const textoClean = texto.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

          if (blockType === "table") {
            // Locate the block first so we can use the original para's styles
            const probe = replaceFirstAdaptBlockWithOoxml(xmlContent, "");
            const ooxmlTable = tableJsonToOoxml(textoClean, probe.originalParaXml);
            if (ooxmlTable) {
              zip.file(
                docXmlFile,
                replaceFirstAdaptBlockWithOoxml(xmlContent, ooxmlTable).xml
              );
            } else {
              // AI didn't return valid JSON — remove the entire block cleanly
              // so no instruction text leaks into the final document XML.
              zip.file(docXmlFile, replaceFirstAdaptBlockInXml(xmlContent, ""));
            }
          } else {
            // Sanitize stray { } in AI output — docxtemplater interprets them
            // as variable tags and can corrupt the document.
            const textoSafe = textoClean
              .replace(/\{/g, "[")
              .replace(/\}/g, "]");
            zip.file(docXmlFile, replaceFirstAdaptBlockInXml(xmlContent, textoSafe));
          }
        } catch {
          // Graceful degradation: remove the entire AI_ADAPT block so the
          // instruction text never leaks into the final document.
          zip.file(docXmlFile, replaceFirstAdaptBlockInXml(xmlContent, ""));
        }
      }
    } catch {
      // Non-critical — continue to docxtemplater step
    }
  }

  // ── Logo substitution (header image) ─────────────────────────────────────
  let logoSubstituida = false;
  const resolvedLogoPath = await materializeStorageFile(options.logoPath);
  if (resolvedLogoPath) {
    onProgress?.("Substituindo logo...");
    logoSubstituida = await replaceLogo(zip, resolvedLogoPath);
  }

  // ── Inject {cliente_logo} variable as inline image in body/headers ────────
  // Runs before docxtemplater so the {cliente_logo} placeholder paragraph is
  // replaced with a <w:drawing> element at the XML level.  If no logo is
  // available the variaveis fallback ("") will clear the placeholder.
  if (resolvedLogoPath) {
    await injectLogoVariable(zip, resolvedLogoPath);
  }

  // ── Strip any remaining {%...} tags (legacy templates) ───────────────────
  // docxtemplater doesn't understand the {%...} syntax — remove them so the
  // template doesn't throw an "unclosed tag" error.
  const xmlFilesToStrip = Object.keys(zip.files).filter(
    (name) => name.startsWith("word/") && name.endsWith(".xml")
  );
  for (const xmlFile of xmlFilesToStrip) {
    try {
      let xml = zip.files[xmlFile]?.asText();
      if (!xml) continue;
      // Remove {%anything} occurrences — handles intact and XML-split cases.
      // The pattern allows XML tags between {% and } so split runs are covered.
      xml = xml.replace(/\{%(?:[^{}]|<[^>]+>)*\}/g, "");
      zip.file(xmlFile, xml);
    } catch {
      // Non-critical
    }
  }

  // ── Final safety sweep: remove any leftover AI_ADAPT markers ───────────────
  // If the regex loop above missed an edge-case block (e.g. a block split
  // across rels or content-types), stray [AI_ADAPT_START] / [AI_ADAPT_END]
  // text nodes in the document XML will make Word report "conteúdo ilegível".
  // This pass ensures they are always gone before docxtemplater runs.
  const xmlFilesForMarkerSweep = Object.keys(zip.files).filter(
    (name) => name.startsWith("word/") && name.endsWith(".xml")
  );
  for (const xmlFile of xmlFilesForMarkerSweep) {
    try {
      let xml = zip.files[xmlFile]?.asText();
      if (!xml) continue;
      // Remove markers even if XML tags have been injected between their characters
      if (xml.includes("AI_ADAPT_START") || xml.includes("AI_ADAPT_END")) {
        // First attempt clean block removal; if residues remain, strip bare markers
        xml = xml
          .replace(/\[AI_ADAPT_START\]/g, "")
          .replace(/\[AI_ADAPT_END\]/g, "")
          // Also catch XML-split markers where tags interleave the text
          .replace(/\[AI_ADAPT_START[^\]]*\]/g, "")
          .replace(/\[AI_ADAPT_END[^\]]*\]/g, "");
        zip.file(xmlFile, xml);
      }
    } catch {
      // Non-critical
    }
  }

  // ── Sanitize any residual markdown from <w:t> nodes (safety net) ─────────
  // The AI might still produce ** or * despite prompt instructions.
  // This pass removes them from every text node before docxtemplater renders.
  try {
    const docXmlForSanitize = zip.files["word/document.xml"]?.asText();
    if (docXmlForSanitize) {
      zip.file("word/document.xml", sanitizeXmlFromMarkdown(docXmlForSanitize));
    }
  } catch {
    // Non-critical
  }

  // Insert confirmed POP equipment inside the existing materials section.
  // This keeps templates untouched and skips uncertain documents/sections.
  if (
    shouldInjectEquipamentosNoPop(options) &&
    options.equipamentosDoPop &&
    options.equipamentosDoPop.length > 0
  ) {
    const docXmlForEquipment = zip.files["word/document.xml"]?.asText();
    if (docXmlForEquipment) {
      const result = injectEquipamentosIntoMaterialsSection(
        docXmlForEquipment,
        options.equipamentosDoPop
      );
      if (result.inserted) {
        zip.file("word/document.xml", result.xml);
      }
    }
  }

  // ── docxtemplater variable substitution ──────────────────────────────────
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render(variaveis);

  const outputBuffer = doc.getZip().generate({ type: "nodebuffer" });
  assertValidDocxBuffer(outputBuffer);

  const outputFileName = createOutputDocxFileName(nomeArquivo);
  const outputPath = await saveGeneratedDocx(outputDir, outputFileName, outputBuffer);

  return { outputPath, tokensTotal, logoSubstituida };
}
