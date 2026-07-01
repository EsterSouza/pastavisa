import PizZip from "pizzip";

/**
 * Counts real [AI_ADAPT_START] markers inside a template's document.xml.
 * Returns null when the buffer can't be parsed (corrupt/non-docx) so callers
 * can leave the processingType untouched instead of misclassifying it.
 */
export function countAiAdaptBlocks(buffer: Buffer): number | null {
  try {
    const zip = new PizZip(buffer);
    const xml = zip.files["word/document.xml"]?.asText() || "";
    const plain = xml.replace(/<[^>]+>/g, "");
    const matches = plain.match(/\[AI_ADAPT_START\]/g);
    return matches ? matches.length : 0;
  } catch {
    return null;
  }
}
