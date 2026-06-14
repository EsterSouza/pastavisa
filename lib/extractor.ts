import fs from "fs";

type LegacyPdfParse = (buf: Buffer) => Promise<{ text: string }>;
type ModernPdfParser = {
  getText: () => Promise<{ text: string }>;
  destroy?: () => Promise<void>;
};
type ModernPdfParseClass = new (options: { data: Buffer }) => ModernPdfParser;

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  // pdf-parse v1 exported a function; v2 exports PDFParse as a class.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require("pdf-parse");
  const legacyParse: unknown = typeof raw === "function" ? raw : raw.default;

  if (typeof legacyParse === "function") {
    const data = await (legacyParse as LegacyPdfParse)(buffer);
    return data.text;
  }

  const Parser = raw.PDFParse as ModernPdfParseClass | undefined;
  if (typeof Parser === "function") {
    const parser = new Parser({ data: buffer });
    try {
      const data = await parser.getText();
      return data.text;
    } finally {
      await parser.destroy?.();
    }
  }

  throw new Error("pdf-parse não carregou corretamente. Verifique a instalação.");
}

export async function extractPdfText(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  return parsePdfBuffer(buffer);
}

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  return parsePdfBuffer(buffer);
}

export async function extractDocxText(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

export async function extractDocxTextFromBuffer(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
