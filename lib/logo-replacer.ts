import fs from "fs";
import path from "path";
import sharp from "sharp";
import PizZip from "pizzip";

// ─── Inline logo injection ({cliente_logo} variable) ─────────────────────────

/**
 * Finds all Word XML files (document + headers) that contain the plain-text
 * string `{cliente_logo}` after stripping XML tags.
 */
function findXmlFilesWithLogoVar(zip: PizZip): string[] {
  return Object.keys(zip.files).filter((name) => {
    if (!name.startsWith("word/") || !name.endsWith(".xml")) return false;
    try {
      const xml = zip.files[name].asText();
      const plain = xml.replace(/<[^>]+>/g, "");
      return plain.includes("{cliente_logo}");
    } catch {
      return false;
    }
  });
}

/**
 * Finds the width (in twips) of the table cell that contains the
 * `{cliente_logo}` placeholder, so the injected logo can be sized to fill that
 * cell instead of a fixed cap. Returns null when the placeholder is not inside
 * a table cell (e.g. used in the body), in which case the caller falls back to
 * the default caps.
 *
 * The non-greedy `<w:tc>…</w:tc>` match is safe here because the logo cells in
 * these templates are simple (no nested tables).
 */
function findLogoCellWidthTwips(xml: string): number | null {
  const cells = xml.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || [];
  for (const cell of cells) {
    if (cell.replace(/<[^>]+>/g, "").includes("{cliente_logo}")) {
      const match = cell.match(/<w:tcW\s+w:w="(\d+)"/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}

/**
 * Returns the next available rId number for the given rels file.
 */
function nextRid(relsXml: string): number {
  const ids = Array.from(relsXml.matchAll(/Id="rId(\d+)"/g)).map((m) =>
    parseInt(m[1])
  );
  return ids.length > 0 ? Math.max(...ids) + 1 : 10;
}

/**
 * Builds the relationship file path for a given Word XML file.
 * e.g. "word/document.xml" → "word/_rels/document.xml.rels"
 *      "word/header1.xml"  → "word/_rels/header1.xml.rels"
 */
function relsPathFor(xmlPath: string): string {
  const dir = path.posix.dirname(xmlPath); // e.g. "word"
  const base = path.posix.basename(xmlPath); // e.g. "document.xml"
  return `${dir}/_rels/${base}.rels`;
}

function ensureContentTypeDefault(zip: PizZip, ext: string): void {
  const contentType =
    ext === "png" ? "image/png" :
    ext === "jpeg" || ext === "jpg" ? "image/jpeg" :
    null;
  if (!contentType) return;

  const contentTypesPath = "[Content_Types].xml";
  let xml = zip.files[contentTypesPath]?.asText();
  if (!xml || xml.includes(`Extension="${ext}"`)) return;

  xml = xml.replace(
    "</Types>",
    `<Default Extension="${ext}" ContentType="${contentType}"/></Types>`
  );
  zip.file(contentTypesPath, xml);
}

/**
 * Injects the client logo as an inline image wherever `{cliente_logo}` appears
 * in the document body or headers.  The placeholder paragraph is replaced with
 * a `<w:p>` that wraps a `<w:drawing>` element pointing to the inserted image.
 *
 * If no logo file is provided (or the variable is not found), this is a no-op —
 * the generator will fall back to replacing `{cliente_logo}` with "" via the
 * variaveis map.
 */
export async function injectLogoVariable(
  zip: PizZip,
  logoPath: string
): Promise<void> {
  if (!fs.existsSync(logoPath)) return;

  const xmlFiles = findXmlFilesWithLogoVar(zip);
  if (xmlFiles.length === 0) return;

  // ── Prepare image ──────────────────────────────────────────────────────────
  const logoBuffer = fs.readFileSync(logoPath);
  const isJpeg = /\.(jpg|jpeg)$/i.test(logoPath);
  const ext = isJpeg ? "jpeg" : "png";

  let convertedBuffer: Buffer;
  let imgWidth: number;
  let imgHeight: number;

  try {
    const metadata = await sharp(logoBuffer).metadata();
    imgWidth = metadata.width ?? 400;
    imgHeight = metadata.height ?? 150;
    convertedBuffer = isJpeg
      ? await sharp(logoBuffer).jpeg({ quality: 95 }).toBuffer()
      : await sharp(logoBuffer).png().toBuffer();
  } catch {
    return; // If sharp fails, skip — variaveis fallback will clear the tag
  }

  // Add image to zip media (one shared copy for all XML files)
  const mediaRelPath = `media/logo_cliente_body.${ext}`;
  const mediaZipPath = `word/${mediaRelPath}`;
  zip.file(mediaZipPath, convertedBuffer, { binary: true });
  ensureContentTypeDefault(zip, ext);

  // ── Base EMU dimensions (at natural pixel size, 100 DPI) ─────────────────
  const baseWidthEmu  = imgWidth  * 9144;
  const baseHeightEmu = imgHeight * 9144;

  // 1 twip = 635 EMU. Header logos are sized to fill the width of their table
  // cell (minus a small inset so they don't touch the borders), with a height
  // cap so portrait logos don't blow the header up. The aspect ratio is always
  // preserved and the image is never upscaled past its natural size.
  const TWIP_TO_EMU = 635;
  const HEADER_CELL_INSET = 0.92;       // ~8% inset from the cell borders
  const HEADER_MAX_HEIGHT_EMU = 684_000; // ~1.9 cm — keeps the header row from growing

  // ── Process each XML file that contains the variable ─────────────────────
  for (const xmlFile of xmlFiles) {
    const isHeaderXml = /^word\/header/i.test(xmlFile);
    const fileXml = zip.files[xmlFile]?.asText() ?? "";

    // Fit the logo to the actual cell width when possible (fills the header
    // box); fall back to the previous fixed caps otherwise (1.5 cm header / 5 cm body).
    const cellWidthTwips = isHeaderXml ? findLogoCellWidthTwips(fileXml) : null;
    const maxWidthEmu = cellWidthTwips
      ? Math.round(cellWidthTwips * TWIP_TO_EMU * HEADER_CELL_INSET)
      : (isHeaderXml ? 540_000 : 1_800_000);
    const maxHeightEmu = isHeaderXml ? HEADER_MAX_HEIGHT_EMU : 3_600_000;

    const scaleRatio = Math.min(
      1,
      maxWidthEmu / baseWidthEmu,
      maxHeightEmu / baseHeightEmu
    );
    const widthEmu  = Math.round(baseWidthEmu  * scaleRatio);
    const heightEmu = Math.round(baseHeightEmu * scaleRatio);

    const relsPath = relsPathFor(xmlFile);

    // Add relationship for this XML file
    let relsXml =
      zip.files[relsPath]?.asText() ??
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

    const rid = `rId${nextRid(relsXml)}`;
    const ridNum = parseInt(rid.replace("rId", ""));

    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${mediaRelPath}"/></Relationships>`
    );
    zip.file(relsPath, relsXml);

    // Build inline drawing XML
    const drawing = [
      `<w:drawing>`,
      `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">`,
      `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>`,
      `<wp:effectExtent l="0" t="0" r="0" b="0"/>`,
      `<wp:docPr id="${ridNum}" name="logo_cliente"/>`,
      `<wp:cNvGraphicFramePr>`,
      `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>`,
      `</wp:cNvGraphicFramePr>`,
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`,
      `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
      `<pic:nvPicPr><pic:cNvPr id="0" name="logo_cliente"/><pic:cNvPicPr/></pic:nvPicPr>`,
      `<pic:blipFill>`,
      `<a:blip r:embed="${rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>`,
      `<a:stretch><a:fillRect/></a:stretch>`,
      `</pic:blipFill>`,
      `<pic:spPr>`,
      `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>`,
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`,
      `</pic:spPr>`,
      `</pic:pic>`,
      `</a:graphicData>`,
      `</a:graphic>`,
      `</wp:inline>`,
      `</w:drawing>`,
    ].join("");

    // ── CRITICAL FIX: normalize self-closing empty paragraphs BEFORE the loop.
    // Templates can contain <w:p ... /> (self-closing) immediately before a table.
    // The paragraph regex `<w:p[ >][\s\S]*?<\/w:p>` would start on this self-closing
    // paragraph and greedily consume everything up to the next </w:p> — which may be
    // INSIDE a table cell, destroying <w:tbl>, <w:tr>, <w:tc> opening tags in the
    // process and producing invalid XML that Word rejects as "conteúdo ilegível".
    //
    // Converting <w:p .../> → <w:p ...></w:p> ensures the regex matches a tight
    // open/close pair for that empty paragraph and never spans across table structures.
    let xml = zip.files[xmlFile].asText();
    xml = xml.replace(/<w:p(?=[\s>])([^>]*)\/>/g, (_, attrs) => `<w:p${attrs}></w:p>`);

    // Replace each <w:p> that contains {cliente_logo} with an image paragraph.
    // We preserve paragraph properties (<w:pPr>) so alignment/spacing are kept.
    xml = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
      const plainPara = para.replace(/<[^>]+>/g, "");
      if (!plainPara.includes("{cliente_logo}")) return para;
      const pPrMatch = para.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
      const pPr = pPrMatch ? pPrMatch[0] : "";
      return `<w:p>${pPr}<w:r>${drawing}</w:r></w:p>`;
    });

    zip.file(xmlFile, xml);
  }
}

/**
 * Finds the logo image path inside a docx zip by inspecting header rels.
 * Returns the zip-internal path (e.g. "word/media/image2.jpeg") and the format.
 */
function findLogoInZip(zip: PizZip): { zipPath: string; format: "jpeg" | "png" } | null {
  const headerRels = [
    "word/_rels/header1.xml.rels",
    "word/_rels/header2.xml.rels",
    "word/_rels/header3.xml.rels",
  ];

  for (const relPath of headerRels) {
    if (!zip.files[relPath]) continue;
    const relsXml = zip.files[relPath].asText();

    // Parse all image relationships, sorted by rId number
    const matches = Array.from(relsXml.matchAll(/Id="rId(\d+)"[^>]*Type="[^"]*\/image"[^>]*Target="([^"]+)"/g));
    if (matches.length === 0) {
      // Try alternate attribute order
      const altMatches = Array.from(relsXml.matchAll(/Target="(media\/[^"]+)"[^>]*Type="[^"]*\/image"/g));
      if (altMatches.length > 0) {
        const target = altMatches[0][1];
        const zipPath = `word/${target}`;
        const format = zipPath.toLowerCase().includes(".png") ? "png" : "jpeg";
        if (zip.files[zipPath]) return { zipPath, format };
      }
      continue;
    }

    // Sort by rId number, take the one with the lowest rId (first = logo)
    const sorted = matches.sort((a, b) => parseInt(a[1]) - parseInt(b[1]));
    const target = sorted[0][2];
    const zipPath = target.startsWith("media/") ? `word/${target}` : target;
    const format = zipPath.toLowerCase().endsWith(".png") ? "png" : "jpeg";
    if (zip.files[zipPath]) return { zipPath, format };
  }
  return null;
}

/**
 * Given all header rels, finds ALL unique logo paths (the same logo can appear
 * in multiple headers — all need to be replaced).
 */
function findAllLogoPathsInZip(zip: PizZip): Array<{ zipPath: string; format: "jpeg" | "png" }> {
  // First, find the canonical logo using the priority heuristic
  const canonical = findLogoInZip(zip);
  if (!canonical) return [];

  const results: Array<{ zipPath: string; format: "jpeg" | "png" }> = [canonical];

  // Scan all header rels — if the same base filename appears, include it
  const canonicalBase = path.basename(canonical.zipPath);
  const headerRels = [
    "word/_rels/header1.xml.rels",
    "word/_rels/header2.xml.rels",
    "word/_rels/header3.xml.rels",
  ];

  for (const relPath of headerRels) {
    if (!zip.files[relPath]) continue;
    const relsXml = zip.files[relPath].asText();
    const targets = Array.from(relsXml.matchAll(/Target="(media\/[^"]+)"/g)).map((m) => m[1]);
    for (const target of targets) {
      const zipPath = `word/${target}`;
      if (zipPath !== canonical.zipPath && zip.files[zipPath]) {
        // Only replace images that share the same filename (logo in different headers)
        if (path.basename(zipPath) === canonicalBase) {
          const format = zipPath.toLowerCase().endsWith(".png") ? "png" : "jpeg";
          if (!results.find((r) => r.zipPath === zipPath)) {
            results.push({ zipPath, format });
          }
        }
      }
    }
  }

  return results;
}

/**
 * After replacing the logo bytes in a docx, patches the <wp:extent> and
 * <a:ext> dimensions in ALL header XML files so the logo stays small.
 *
 * Max width for headers = 1.5 cm (540 000 EMU). Height is proportional.
 *
 * Uses simple, independent attribute-level regexes to avoid the ordering
 * issues that made the previous combined patterns unreliable.
 */
async function capHeaderLogoDimensions(
  zip: PizZip,
  logoBuffer: Buffer
): Promise<void> {
  const MAX_HEADER_WIDTH_EMU = 540_000; // 1.5 cm

  let naturalW: number;
  let naturalH: number;
  try {
    const meta = await sharp(logoBuffer).metadata();
    naturalW = meta.width ?? 200;
    naturalH = meta.height ?? 100;
  } catch {
    return;
  }

  // 1 px ≈ 9144 EMU (at 96 dpi)
  const naturalWEmu = naturalW * 9144;
  const naturalHEmu = naturalH * 9144;
  const scale = Math.min(1, MAX_HEADER_WIDTH_EMU / naturalWEmu);
  const targetCx = Math.round(naturalWEmu * scale);
  const targetCy = Math.round(naturalHEmu * scale);

  const headerFiles = Object.keys(zip.files).filter(
    (f) => /^word\/header\d*\.xml$/i.test(f)
  );

  for (const hFile of headerFiles) {
    try {
      let xml = zip.files[hFile].asText();

      // Replace cx and cy independently for each element type.
      // Using non-greedy [^>]*? to stay within the element boundaries.
      // wp:extent — inline drawing extent
      xml = xml.replace(/(wp:extent[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`);
      xml = xml.replace(/(wp:extent[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`);
      // a:ext — render size inside <pic:spPr>
      xml = xml.replace(/(a:ext[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`);
      xml = xml.replace(/(a:ext[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`);

      zip.file(hFile, xml);
    } catch {
      // Non-critical — skip this header
    }
  }
}

/**
 * Replaces the logo image in a docx zip with the client's logo.
 * Handles format conversion (PNG ↔ JPEG) using sharp.
 * Also caps the rendered size in headers to 2 cm width.
 */
export async function replaceLogo(zip: PizZip, logoPath: string): Promise<boolean> {
  if (!fs.existsSync(logoPath)) return false;

  const logoPaths = findAllLogoPathsInZip(zip);
  if (logoPaths.length === 0) return false;

  const logoBuffer = fs.readFileSync(logoPath);

  for (const { zipPath, format } of logoPaths) {
    try {
      let convertedBuffer: Buffer;
      if (format === "jpeg") {
        convertedBuffer = await sharp(logoBuffer).jpeg({ quality: 95 }).toBuffer();
      } else {
        convertedBuffer = await sharp(logoBuffer).png().toBuffer();
      }

      // Replace the image in the zip
      zip.file(zipPath, convertedBuffer, { binary: true });
      ensureContentTypeDefault(zip, format);
    } catch (err) {
      console.error(`[logo-replacer] Falha ao substituir ${zipPath}:`, err);
      // Continue with other paths even if one fails
    }
  }

  // Cap logo dimensions in header XML so it fits neatly in the header table cell
  await capHeaderLogoDimensions(zip, logoBuffer);

  return true;
}

// ─── Logo cell background color ───────────────────────────────────────────────

/**
 * Normalizes a user-supplied color to a 6-digit uppercase hex (no leading #).
 * Accepts "#abc", "abc", "#AABBCC", "aabbcc". Returns null when invalid.
 */
function normalizeHexColor(value?: string | null): string | null {
  if (!value) return null;
  let v = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    v = v.split("").map((c) => c + c).join("");
  }
  return /^[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
}

/**
 * Inserts (or replaces) a `<w:shd>` cell-shading element inside a single
 * `<w:tc>` block, respecting the CT_TcPr child order required by the OOXML
 * schema (shd must come right after tcBorders / vMerge / tcW). Word rejects
 * out-of-order children as "conteúdo ilegível", so the anchor matters.
 */
function setCellShading(cell: string, fill: string): string {
  const shd = `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;

  // Drop any existing shading first (both self-closing and paired forms).
  const next = cell
    .replace(/<w:shd\b[^>]*\/>/g, "")
    .replace(/<w:shd\b[^>]*>[\s\S]*?<\/w:shd>/g, "");

  if (/<w:tcPr\b/.test(next)) {
    if (/<\/w:tcBorders>/.test(next)) {
      return next.replace(/<\/w:tcBorders>/, `</w:tcBorders>${shd}`);
    }
    if (/<w:vMerge\b[^>]*\/>/.test(next)) {
      return next.replace(/(<w:vMerge\b[^>]*\/>)/, `$1${shd}`);
    }
    if (/<w:tcW\b[^>]*\/>/.test(next)) {
      return next.replace(/(<w:tcW\b[^>]*\/>)/, `$1${shd}`);
    }
    return next.replace(/<w:tcPr\b[^>]*>/, (m) => `${m}${shd}`);
  }

  // Cell has no <w:tcPr> — add a minimal one right after the opening tag.
  return next.replace(/(<w:tc(?:\s[^>]*)?>)/, `$1<w:tcPr>${shd}</w:tcPr>`);
}

/**
 * Paints the background of the header table cell that holds the client logo
 * with the given hex color, across every Word XML file (headers + body).
 *
 * The logo cell is identified by the injected image name `logo_cliente` (set by
 * injectLogoVariable) or by the still-present `{cliente_logo}` placeholder, so
 * this works whether or not a logo image was actually injected.
 *
 * No-op when the color is empty/invalid.
 */
export function applyLogoCellBackground(zip: PizZip, logoBgHex?: string | null): void {
  const fill = normalizeHexColor(logoBgHex);
  if (!fill) return;

  const xmlFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("word/") && name.endsWith(".xml")
  );

  for (const name of xmlFiles) {
    let xml: string;
    try {
      xml = zip.files[name].asText();
    } catch {
      continue;
    }
    if (!xml.includes("logo_cliente") && !xml.includes("{cliente_logo}")) continue;

    const updated = xml.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, (cell) => {
      const isLogoCell = cell.includes("logo_cliente") || cell.includes("{cliente_logo}");
      return isLogoCell ? setCellShading(cell, fill) : cell;
    });

    if (updated !== xml) zip.file(name, updated);
  }
}
