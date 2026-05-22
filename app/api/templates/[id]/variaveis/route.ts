import { NextRequest, NextResponse } from "next/server";
import PizZip from "pizzip";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extracts all {variable_name} tokens from a docx file
async function extractVariables(filePath: string): Promise<string[]> {
  try {
    const content = await readStorageBuffer(filePath);
    const zip = new PizZip(content);

    const xmlFiles = [
      "word/document.xml",
      "word/header1.xml",
      "word/header2.xml",
      "word/header3.xml",
      "word/footer1.xml",
      "word/footer2.xml",
    ];

    const found = new Set<string>();
    for (const xmlFile of xmlFiles) {
      const xml = zip.files[xmlFile]?.asText();
      if (!xml) continue;
      // Strip XML tags then find {variable_name} patterns
      const plain = xml.replace(/<[^>]+>/g, " ");
      const matches = Array.from(plain.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g));
      for (const m of matches) found.add(m[1]);
    }

    return Array.from(found).sort();
  } catch {
    return [];
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = await prisma.template.findUnique({ where: { id: params.id } });
  if (!template) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const variaveis = await extractVariables(template.arquivoPath);
  return NextResponse.json({ variaveis });
}
