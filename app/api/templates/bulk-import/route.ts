import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { detectProcessingType } from "@/lib/classifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TEMPLATES_SRC_DIR = path.join(process.cwd(), "TODOS_OS_TEMPLATES_PastaVISA");
const TEMPLATES_DEST_DIR = path.join(process.cwd(), "storage", "templates");

// Infer tipo and padraoHeader from filename
function inferMeta(filename: string): { tipo: string; padraoHeader: string } {
  const n = filename.toUpperCase().replace(/[_\-]/g, " ");

  let tipo = "OUTROS";
  if (n.includes("MBP") || n.includes("MANUAL DE BOAS PRATICAS")) tipo = "MBP";
  else if (n.includes("POP") || n.includes("PROCEDIMENTO OPERACIONAL")) tipo = "POP";
  else if (n.includes("TCLE")) tipo = "TCLE";
  else if (n.includes("PGRSS")) tipo = "PGRSS";
  else if (n.includes("FICHA")) tipo = "FICHA";
  else if (n.includes("PLANILHA") || n.includes("CONTROLE")) tipo = "PLANILHA";
  else if (n.includes("GUIA")) tipo = "GUIA";
  else if (n.includes("TERMO") || n.includes("RENUNCIA") || n.includes("RECUSA")) tipo = "TERMO";
  else if (n.includes("RECEITUARIO") || n.includes("ORIENTACOES")) tipo = "RECEITUARIO";
  else if (n.includes("RELACAO")) tipo = "OUTROS";

  let padraoHeader = "A";
  if (tipo === "POP") padraoHeader = "B";
  else if (tipo === "TCLE" || tipo === "FICHA" || tipo === "TERMO" || tipo === "RECEITUARIO") padraoHeader = "C";
  else if (tipo === "PLANILHA") padraoHeader = "C";

  return { tipo, padraoHeader };
}

export async function POST() {
  if (!fs.existsSync(TEMPLATES_SRC_DIR)) {
    return NextResponse.json({ error: "Pasta TODOS_OS_TEMPLATES_PastaVISA não encontrada" }, { status: 404 });
  }

  if (!fs.existsSync(TEMPLATES_DEST_DIR)) {
    fs.mkdirSync(TEMPLATES_DEST_DIR, { recursive: true });
  }

  const files = fs.readdirSync(TEMPLATES_SRC_DIR).filter((f) => f.endsWith(".docx"));
  const results: Array<{ nome: string; status: string; id?: string }> = [];

  for (const file of files) {
    const srcPath = path.join(TEMPLATES_SRC_DIR, file);
    const destFileName = `bulk_${Date.now()}_${file.replace(/[^a-zA-Z0-9._\-]/g, "_")}`;
    const destPath = path.join(TEMPLATES_DEST_DIR, destFileName);

    // Strip TEMPLATE_ prefix and .docx suffix for display name
    const nomeLimpo = file
      .replace(/^TEMPLATE_/, "")
      .replace(/_/g, " ")
      .replace(/\.docx$/i, "");

    // Check if already imported (by nome)
    const existing = await prisma.template.findFirst({ where: { nome: nomeLimpo } });
    if (existing) {
      results.push({ nome: nomeLimpo, status: "já existe", id: existing.id });
      continue;
    }

    try {
      fs.copyFileSync(srcPath, destPath);

      const { tipo, padraoHeader } = inferMeta(file);
      const processingType = detectProcessingType(file);

      const template = await prisma.template.create({
        data: { nome: nomeLimpo, tipo, padraoHeader, processingType, arquivoPath: destPath },
      });

      results.push({ nome: nomeLimpo, status: "importado", id: template.id });
    } catch (err) {
      results.push({ nome: nomeLimpo, status: `erro: ${err instanceof Error ? err.message : "desconhecido"}` });
    }
  }

  return NextResponse.json({ total: files.length, results });
}
