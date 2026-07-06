import sharp from "sharp";
import PizZip from "pizzip";
import {
  relsPathFor,
  ensureContentTypeDefault,
  findAllLogoPathsInZip,
} from "./logo-replacer";
import { assertValidDocxBuffer } from "./docx-validator";

const HEADER_FOOTER_PARTS = [
  "word/header1.xml",
  "word/header2.xml",
  "word/header3.xml",
  "word/footer1.xml",
  "word/footer2.xml",
  "word/footer3.xml",
];

const HEADER_FOOTER_RELS = HEADER_FOOTER_PARTS.map(relsPathFor);

const MAX_LOGO_WIDTH_EMU = 540_000; // ~1.5cm, same cap used for header logos today

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
        if (!sub.de || !text.includes(sub.de)) return;
        text = text.split(sub.de).join(sub.para);
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
    const tMatch = runXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/);
    return { runXml, text: tMatch ? decodeXmlEntities(tMatch[1]) : "" };
  });

  let mergedText = runs.map((r) => r.text).join("");
  const appliedIdx = new Set<number>();

  for (const { sub, i } of remaining) {
    if (mergedText.includes(sub.de)) {
      mergedText = mergedText.split(sub.de).join(sub.para);
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

/**
 * Caps <wp:extent>/<a:ext> cx/cy in the given XML parts to a max width,
 * scaled from the new logo's natural size (keeps aspect ratio, never upscales
 * further than the cap). Scoped to explicit parts so it never touches
 * drawings unrelated to the logo we just swapped.
 */
async function capLogoDimensionsInParts(
  zip: PizZip,
  parts: string[],
  logoBuffer: Buffer
): Promise<void> {
  let naturalW: number;
  let naturalH: number;
  try {
    const meta = await sharp(logoBuffer).metadata();
    naturalW = meta.width ?? 200;
    naturalH = meta.height ?? 100;
  } catch {
    return;
  }

  const naturalWEmu = naturalW * 9144;
  const naturalHEmu = naturalH * 9144;
  const scale = Math.min(1, MAX_LOGO_WIDTH_EMU / naturalWEmu);
  const targetCx = Math.round(naturalWEmu * scale);
  const targetCy = Math.round(naturalHEmu * scale);

  for (const partName of parts) {
    const file = zip.files[partName];
    if (!file) continue;
    try {
      let xml = file.asText();
      xml = xml.replace(/(wp:extent[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`);
      xml = xml.replace(/(wp:extent[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`);
      xml = xml.replace(/(a:ext[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`);
      xml = xml.replace(/(a:ext[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`);
      zip.file(partName, xml);
    } catch {
      // non-critical — skip this part
    }
  }
}

/**
 * Replaces the logo image referenced from any header/footer of this docx
 * (generalizes `replaceLogo` from logo-replacer.ts, which only looks at
 * headers, to also cover footers for the batch-correction flow).
 */
export async function replaceLogoInHeadersAndFooters(
  zip: PizZip,
  logoBuffer: Buffer
): Promise<{ substituida: boolean }> {
  const logoPaths = findAllLogoPathsInZip(zip, HEADER_FOOTER_RELS);
  if (logoPaths.length === 0) return { substituida: false };

  for (const { zipPath, format } of logoPaths) {
    try {
      const converted =
        format === "png"
          ? await sharp(logoBuffer).png().toBuffer()
          : await sharp(logoBuffer).jpeg({ quality: 95 }).toBuffer();
      zip.file(zipPath, converted, { binary: true });
      ensureContentTypeDefault(zip, format);
    } catch (err) {
      console.error(`[header-footer-replace] Falha ao substituir ${zipPath}:`, err);
    }
  }

  await capLogoDimensionsInParts(zip, HEADER_FOOTER_PARTS, logoBuffer);

  return { substituida: true };
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
