/**
 * Converts plain text returned by the AI into valid OOXML paragraphs
 * for injection into word/document.xml.
 *
 * Key behaviours:
 *  - Inherits <w:pPr> and <w:rPr> from the original paragraph that held
 *    the AI_ADAPT marker, so font/size/spacing match the surrounding content.
 *  - Detects bullet lines ("• ") and numbered list lines ("1. ", "2. ", …)
 *    and adds indentation so they are visually offset from body text.
 *  - Removes blank lines that appear between consecutive list items so the
 *    AI's habit of spacing list items (readable in plain text) doesn't
 *    create ugly empty paragraphs inside the Word document.
 *  - Strips any residual markdown characters the AI may sneak through.
 */

/** Escapes a string for safe embedding inside a <w:t> node. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Removes residual markdown syntax from a plain-text string. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*/g, "")        // bold
    .replace(/\*/g, "")          // italic
    .replace(/^#{1,6}\s*/gm, "") // headings
    .replace(/^>\s*/gm, "");     // blockquotes
}

/** Returns true when a line is a bullet or numbered list item. */
function isListLine(s: string): boolean {
  const t = s.trim();
  return t.startsWith("• ") || /^\d+\.\s/.test(t);
}

function buildRunProperties(rPrContent: string): string {
  if (rPrContent.trim()) {
    return `<w:rPr>${rPrContent}</w:rPr>`;
  }

  return (
    `<w:rPr>` +
    `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>` +
    `<w:sz w:val="24"/>` +
    `<w:szCs w:val="24"/>` +
    `</w:rPr>`
  );
}

/**
 * Converts AI output text into a sequence of OOXML <w:p> elements.
 *
 * @param text            Plain text from the AI (may contain \n line breaks).
 * @param originalParaXml The first <w:p>...</w:p> that contained the
 *                        AI_ADAPT_START marker — used to inherit styles.
 */
export function textToOoxmlParagraphs(
  text: string,
  originalParaXml: string
): string {
  if (!text.trim()) return "";

  // Extract paragraph properties from the original para to inherit spacing/indent
  const pPrMatch = originalParaXml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
  const pPrContent = pPrMatch ? pPrMatch[1] : "";

  // Extract run properties (font, size, colour) from the original para
  const rPrMatch = originalParaXml.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  const rPrContent = rPrMatch ? rPrMatch[1] : "";

  const rPrTag = buildRunProperties(rPrContent);

  // ── Normalise line array ────────────────────────────────────────────────────
  // 1. Split on newlines.
  // 2. Collapse consecutive empty lines → at most one.
  // 3. Remove blank lines that fall BETWEEN two list items (numbered or bullet)
  //    — the AI adds them for readability in plain text, but in Word they become
  //    visually distracting empty paragraphs.
  // 4. Strip leading / trailing empty lines.

  const rawLines = text.split("\n");

  // Step 2: collapse consecutive empties
  const collapsed: string[] = [];
  let lastWasEmpty = false;
  for (const line of rawLines) {
    const isEmpty = line.trim().length === 0;
    if (isEmpty && lastWasEmpty) continue;
    collapsed.push(line);
    lastWasEmpty = isEmpty;
  }

  // Step 3: remove blank lines between list items
  const lines: string[] = [];
  for (let i = 0; i < collapsed.length; i++) {
    const line = collapsed[i];
    if (
      line.trim() === "" &&
      i > 0 &&
      i < collapsed.length - 1 &&
      isListLine(collapsed[i - 1]) &&
      isListLine(collapsed[i + 1])
    ) {
      continue; // drop blank between list items
    }
    lines.push(line);
  }

  // Step 4: strip leading / trailing empties
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

  // ── Render each line as a <w:p> ────────────────────────────────────────────
  return lines
    .map((line) => {
      const trimmed = stripMarkdown(line.trim());

      // Empty line → empty paragraph (preserves single blank lines between
      // non-list paragraphs so the document keeps intentional spacing)
      if (!trimmed) {
        return pPrContent
          ? `<w:p><w:pPr>${pPrContent}</w:pPr></w:p>`
          : `<w:p/>`;
      }

      const isBullet  = trimmed.startsWith("• ");
      const isNumbered = !isBullet && /^\d+\.\s/.test(trimmed);
      const isList    = isBullet || isNumbered;

      // Add left indent for list items when the original paragraph has none.
      // This keeps them visually distinct from body text without requiring
      // a numbering definition (which may not exist in every template).
      let effectivePPrContent = pPrContent;
      if (isList && !pPrContent.includes("<w:ind")) {
        effectivePPrContent += `<w:ind w:left="360"/>`;
      }

      const pPrTag = effectivePPrContent
        ? `<w:pPr>${effectivePPrContent}</w:pPr>`
        : "";

      return (
        `<w:p>` +
        pPrTag +
        `<w:r>` +
        rPrTag +
        `<w:t xml:space="preserve">${xmlEscape(trimmed)}</w:t>` +
        `</w:r>` +
        `</w:p>`
      );
    })
    .join("");
}

/**
 * Safety net: strips residual markdown from every <w:t> node in the XML.
 * Called right before docxtemplater renders, catching anything the AI
 * sneaked through despite prompt instructions.
 */
export function sanitizeXmlFromMarkdown(xmlContent: string): string {
  return xmlContent.replace(
    /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g,
    (_match, open: string, content: string, close: string) => {
      return `${open}${stripMarkdown(content)}${close}`;
    }
  );
}
