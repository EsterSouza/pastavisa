import sharp from "sharp";
import PizZip from "pizzip";
import { relsPathFor, ensureContentTypeDefault } from "./logo-replacer";
import { assertValidDocxBuffer } from "./docx-validator";

const HEADER_FOOTER_PARTS = [
  "word/header1.xml",
  "word/header2.xml",
  "word/header3.xml",
  "word/footer1.xml",
  "word/footer2.xml",
  "word/footer3.xml",
];

export interface Substituicao {
  de: string;
  para: string;
}

export interface AplicarBatchResult {
  buffer: Buffer;
  aplicadas: string[];
  naoEncontradas: string[];
  logoSubstituida: boolean;
}

/** Which header/footer XML parts actually exist in this docx. */
export function listHeaderFooterParts(zip: PizZip): string[] {
  return HEADER_FOOTER_PARTS.filter((name) => !!zip.files[name]);
}

function normalizeSelfClosingParagraphs(xml: string): string {
  // Same fix as logo-replacer.ts: <w:p ... /> must become <w:p ...></w:p> before
  // running a non-greedy <w:p>...</w:p> regex, otherwise it can swallow table
  // structure that follows an empty self-closing paragraph.
  return xml.replace(/<w:p(?=[\s>])([^>]*)\/>/g, (_, attrs) => `<w:p${attrs}></w:p>`);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXmlEntities(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeReplacement(value: string): string {
  // "$" has special meaning ($&, $1, $$...) as a String.replace replacement
  // when the pattern is a RegExp — escape literal "$" so "para" is inserted verbatim.
  return value.replace(/\$/g, "$$$$");
}

/**
 * Builds a regex that matches `de` literally except for whitespace: any run
 * of spaces/tabs/newlines/non-breaking-space ( , common when pasting
 * from Word) in `de` matches any run of whitespace in the document. This is
 * still an exact match on content — it only tolerates the kind of whitespace
 * noise Word introduces (extra spaces, tabs vs spaces, NBSP), never guesses
 * at different wording.
 */
function buildFlexibleWhitespacePattern(de: string): RegExp {
  const escaped = escapeRegExp(de);
  // "*" (zero or more), not "+" \u2014 the pasted text may have spaces around
  // punctuation (e.g. "CNPJ : 123") that simply aren't there in the actual
  // run text ("CNPJ: 123"), so the tolerant match must also accept none.
  const flexible = escaped.replace(/[ \t\n\r\u00A0]+/g, "\\s*");
  return new RegExp(flexible, "g");
}

/** Extracts a run's visible text, representing `<w:tab/>`/`<w:br/>` as literal
 * whitespace characters so substitutions can match text that spans across
 * them (e.g. "CNPJ: X" <tab> "Endereço: Y" inside the same paragraph). */
function extractRunText(runXml: string): string {
  const parts: string[] = [];
  const tokenRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(runXml)) !== null) {
    if (match[0].startsWith("<w:t")) {
      parts.push(decodeXmlEntities(match[1] ?? ""));
    } else if (match[0].startsWith("<w:tab")) {
      parts.push("\t");
    } else {
      parts.push("\n");
    }
  }
  return parts.join("");
}

/**
 * Applies every substitution that fits inside a single `<w:t>` run of this
 * paragraph. Returns the updated paragraph XML and which substitution indexes
 * (into the original `substituicoes` array) were applied.
 */
function applySingleRunSubstitutions(
  paragraphXml: string,
  substituicoes: Substituicao[]
): { xml: string; appliedIdx: Set<number> } {
  const appliedIdx = new Set<number>();

  const xml = paragraphXml.replace(
    /<w:t([^>]*)>([\s\S]*?)<\/w:t>/g,
    (match, attrs: string, inner: string) => {
      let text = decodeXmlEntities(inner);
      let changed = false;
      substituicoes.forEach((sub, i) => {
        if (!sub.de) return;
        const pattern = buildFlexibleWhitespacePattern(sub.de);
        const replaced = text.replace(pattern, escapeReplacement(sub.para));
        if (replaced === text) return;
        text = replaced;
        appliedIdx.add(i);
        changed = true;
      });
      if (!changed) return match;
      return `<w:t${attrs}>${encodeXmlEntities(text)}</w:t>`;
    }
  );

  return { xml, appliedIdx };
}

/**
 * Fallback for substitutions whose "de" text is split across multiple runs in
 * the same paragraph (common once a document has been hand-edited in Word).
 * Merges the paragraph's run text, applies the remaining substitutions, and
 * writes the merged result into the first run (keeping its `<w:rPr>`), while
 * clearing the `<w:t>` of the other runs in that paragraph.
 */
function applyMergedRunSubstitutions(
  paragraphXml: string,
  substituicoes: Substituicao[],
  alreadyApplied: Set<number>
): { xml: string; appliedIdx: Set<number> } {
  const remaining = substituicoes
    .map((sub, i) => ({ sub, i }))
    .filter(({ sub, i }) => sub.de && !alreadyApplied.has(i));

  if (remaining.length === 0) return { xml: paragraphXml, appliedIdx: new Set() };

  const runMatches = Array.from(paragraphXml.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g));
  if (runMatches.length === 0) return { xml: paragraphXml, appliedIdx: new Set() };

  const runs = runMatches.map((m) => {
    const runXml = m[0];
    return { runXml, text: extractRunText(runXml) };
  });

  let mergedText = runs.map((r) => r.text).join("");
  const appliedIdx = new Set<number>();

  for (const { sub, i } of remaining) {
    const pattern = buildFlexibleWhitespacePattern(sub.de);
    const replaced = mergedText.replace(pattern, escapeReplacement(sub.para));
    if (replaced !== mergedText) {
      mergedText = replaced;
      appliedIdx.add(i);
    }
  }

  if (appliedIdx.size === 0) return { xml: paragraphXml, appliedIdx };

  const firstRunXml = runs[0].runXml;
  const rPrMatch = firstRunXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
  const rPr = rPrMatch ? rPrMatch[0] : "";
  const newFirstRun = `<w:r>${rPr}<w:t xml:space="preserve">${encodeXmlEntities(mergedText)}</w:t></w:r>`;

  let runIndex = 0;
  const xml = paragraphXml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (runXml) => {
    const idx = runIndex++;
    if (idx === 0) return newFirstRun;
    if (/<w:t[^>]*>[\s\S]*?<\/w:t>/.test(runXml)) {
      return runXml.replace(/<w:t([^>]*)>[\s\S]*?<\/w:t>/, "<w:t$1></w:t>");
    }
    // Standalone <w:tab/>/<w:br/> markers are represented as a literal
    // "\t"/"\n" character inside the merged first run's text (see
    // extractRunText) — strip the original element here too, otherwise the
    // gap would render twice (once as a real tab stop, once as the character).
    if (/<w:(?:tab|br|cr)\b[^>]*\/>/.test(runXml)) {
      return runXml.replace(/<w:(?:tab|br|cr)\b[^>]*\/>/g, "");
    }
    return runXml;
  });

  return { xml, appliedIdx };
}

/**
 * Applies "de -> para" substitutions across the given header/footer XML parts.
 * Never guesses: a pair only counts as applied when its exact "de" text was
 * found (either in one run, or reconstructed across runs of the same
 * paragraph) somewhere in the document; otherwise it's reported as not found
 * and nothing is touched.
 */
export function replaceTextInParts(
  zip: PizZip,
  parts: string[],
  substituicoes: Substituicao[]
): { aplicadas: string[]; naoEncontradas: string[] } {
  const valid = substituicoes.filter((s) => s.de && s.de.length > 0);
  const foundIdx = new Set<number>();

  for (const partName of parts) {
    const file = zip.files[partName];
    if (!file) continue;

    let xml = normalizeSelfClosingParagraphs(file.asText());
    let partChanged = false;

    xml = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
      const step1 = applySingleRunSubstitutions(paragraph, valid);
      step1.appliedIdx.forEach((i) => foundIdx.add(i));

      const step2 = applyMergedRunSubstitutions(step1.xml, valid, step1.appliedIdx);
      step2.appliedIdx.forEach((i) => foundIdx.add(i));

      const finalParagraph = step2.appliedIdx.size > 0 ? step2.xml : step1.xml;
      if (finalParagraph !== paragraph) partChanged = true;
      return finalParagraph;
    });

    if (partChanged) zip.file(partName, xml);
  }

  const aplicadas = valid.filter((_, i) => foundIdx.has(i)).map((s) => s.de);
  const naoEncontradas = valid.filter((_, i) => !foundIdx.has(i)).map((s) => s.de);

  return { aplicadas, naoEncontradas };
}

const TWIP_TO_EMU = 635;
const HEADER_CELL_INSET = 0.92; // ~8% inset from the cell borders, same as the main generation flow
const HEADER_MAX_HEIGHT_EMU = 684_000; // ~1.9cm — keeps the header row from growing

/**
 * Parses every `<Relationship .../>` in a rels file independently of
 * attribute order and returns the image with the lowest rId — real-world
 * documents (hand-edited in Word over time) don't always keep `Id`/`Type`/
 * `Target` in the same order the main generation flow produces.
 */
function findPartImageReference(relsXml: string): { rId: string; target: string } | null {
  const relationships = Array.from(relsXml.matchAll(/<Relationship\b[^>]*\/>/g)).map((m) => m[0]);
  const images: Array<{ id: number; target: string }> = [];

  for (const rel of relationships) {
    const typeMatch = rel.match(/Type="([^"]*)"/);
    if (!typeMatch || !/\/image$/.test(typeMatch[1])) continue;
    const idMatch = rel.match(/Id="rId(\d+)"/);
    const targetMatch = rel.match(/Target="([^"]+)"/);
    if (!idMatch || !targetMatch) continue;
    images.push({ id: parseInt(idMatch[1], 10), target: targetMatch[1] });
  }

  if (images.length === 0) return null;
  images.sort((a, b) => a.id - b.id);
  return { rId: `rId${images[0].id}`, target: images[0].target };
}

/** Finds the width (in twips) of the table cell whose drawing embeds `rId`. */
function findImageCellWidthTwips(xml: string, rId: string): number | null {
  const cells = xml.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || [];
  for (const cell of cells) {
    if (cell.includes(`r:embed="${rId}"`)) {
      const match = cell.match(/<w:tcW\s+w:w="(\d+)"/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}

/**
 * Replaces the logo image referenced from each header/footer of this docx,
 * one part at a time (not one "canonical" image shared across every part —
 * real finalized documents can have a different image per part, e.g. a
 * first-page header referencing something else entirely while the default
 * header has the actual logo cell; picking one canonical basename missed
 * the others). For each part, resizes the drawing to exactly fill the table
 * cell that holds it (upscaling on purpose — the goal is to match the
 * pre-made cell size, not preserve the uploaded photo's native resolution).
 * Parts whose image isn't inside a table cell are left at their original
 * size, since there's no box to measure against.
 */
export async function replaceLogoInHeadersAndFooters(
  zip: PizZip,
  logoBuffer: Buffer
): Promise<{ substituida: boolean }> {
  let naturalW: number;
  let naturalH: number;
  try {
    const meta = await sharp(logoBuffer).metadata();
    naturalW = meta.width ?? 200;
    naturalH = meta.height ?? 100;
  } catch {
    return { substituida: false };
  }
  const naturalWEmu = naturalW * 9144;
  const naturalHEmu = naturalH * 9144;

  let substituida = false;

  for (const partName of HEADER_FOOTER_PARTS) {
    if (!zip.files[partName]) continue;
    const relsPath = relsPathFor(partName);
    if (!zip.files[relsPath]) continue;

    const ref = findPartImageReference(zip.files[relsPath].asText());
    if (!ref) continue;

    const zipPath = ref.target.startsWith("media/") ? `word/${ref.target}` : ref.target;
    if (!zip.files[zipPath]) continue;

    const format = zipPath.toLowerCase().endsWith(".png") ? "png" : "jpeg";
    try {
      const converted =
        format === "png"
          ? await sharp(logoBuffer).png().toBuffer()
          : await sharp(logoBuffer).jpeg({ quality: 95 }).toBuffer();
      zip.file(zipPath, converted, { binary: true });
      ensureContentTypeDefault(zip, format);
      substituida = true;
    } catch (err) {
      console.error(`[header-footer-replace] Falha ao substituir ${zipPath}:`, err);
      continue;
    }

    const partXml = zip.files[partName].asText();
    const cellWidthTwips = findImageCellWidthTwips(partXml, ref.rId);
    if (!cellWidthTwips) continue; // no table cell around this image — leave its size untouched

    const maxWidthEmu = Math.round(cellWidthTwips * TWIP_TO_EMU * HEADER_CELL_INSET);
    const scale = Math.min(maxWidthEmu / naturalWEmu, HEADER_MAX_HEIGHT_EMU / naturalHEmu);
    const targetCx = Math.round(naturalWEmu * scale);
    const targetCy = Math.round(naturalHEmu * scale);

    let resizedXml = partXml;
    resizedXml = resizedXml.replace(/(wp:extent[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`);
    resizedXml = resizedXml.replace(/(wp:extent[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`);
    resizedXml = resizedXml.replace(/(a:ext[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`);
    resizedXml = resizedXml.replace(/(a:ext[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`);
    zip.file(partName, resizedXml);
  }

  return { substituida };
}

/**
 * Orchestrates one round of batch correction on an already-finalized .docx
 * buffer: optionally swaps the logo, optionally applies text substitutions
 * across headers/footers, validates the result, and returns the new buffer
 * plus a per-pair report.
 */
export async function applyBatchChanges(
  buffer: Buffer,
  opts: { logoBuffer?: Buffer; substituicoes?: Substituicao[] }
): Promise<AplicarBatchResult> {
  const zip = new PizZip(buffer);
  const parts = listHeaderFooterParts(zip);

  let logoSubstituida = false;
  if (opts.logoBuffer) {
    const result = await replaceLogoInHeadersAndFooters(zip, opts.logoBuffer);
    logoSubstituida = result.substituida;
  }

  let aplicadas: string[] = [];
  let naoEncontradas: string[] = [];
  if (opts.substituicoes && opts.substituicoes.length > 0) {
    const result = replaceTextInParts(zip, parts, opts.substituicoes);
    aplicadas = result.aplicadas;
    naoEncontradas = result.naoEncontradas;
  }

  const outputBuffer = zip.generate({ type: "nodebuffer" }) as Buffer;
  assertValidDocxBuffer(outputBuffer);

  return { buffer: outputBuffer, aplicadas, naoEncontradas, logoSubstituida };
}
