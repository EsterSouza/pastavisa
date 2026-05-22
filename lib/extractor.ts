import fs from "fs";

export async function extractPdfText(filePath: string): Promise<string> {
  // pdf-parse may be bundled as ESM by Next.js → require() returns { default: fn }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require("pdf-parse");
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
    typeof raw === "function" ? raw : raw.default ?? raw;
  if (typeof pdfParse !== "function") {
    throw new Error("pdf-parse não carregou corretamente. Verifique a instalação.");
  }
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
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
