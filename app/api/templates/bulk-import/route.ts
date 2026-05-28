import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectProcessingType } from "@/lib/classifier";
import { safeStorageFileName, saveStorageBuffer } from "@/lib/file-storage";
import { validateTemplateBuffer } from "@/lib/template-validator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ImportStatus = "importado" | "atualizado" | "erro";

function normalizeTemplateName(value: string): string {
  return value
    .replace(/^bulk_\d+_/i, "")
    .replace(/^TEMPLATE_/i, "")
    .replace(/_/g, " ")
    .replace(/\.docx$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(fileName: string): string {
  return fileName
    .replace(/^bulk_\d+_/i, "")
    .replace(/^TEMPLATE_/i, "")
    .replace(/_/g, " ")
    .replace(/\.docx$/i, "")
    .trim();
}

function inferMeta(fileName: string): { tipo: string; padraoHeader: string } {
  const n = normalizeTemplateName(fileName);
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

  let padraoHeader = "A";
  if (tipo === "POP") padraoHeader = "B";
  else if (["TCLE", "FICHA", "TERMO", "RECEITUARIO", "PLANILHA"].includes(tipo)) padraoHeader = "C";
  return { tipo, padraoHeader };
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData
    .getAll("arquivos")
    .filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um arquivo .docx" }, { status: 400 });
  }

  const existentes = await prisma.template.findMany();
  const existingByName = new Map(
    existentes.map((template) => [normalizeTemplateName(template.nome), template])
  );

  const results: Array<{
    nome: string;
    status: ImportStatus;
    tipo?: string;
    variaveis?: number;
    errosValidacao?: number;
    error?: string;
  }> = [];

  for (const file of files) {
    const nome = displayName(file.name);
    try {
      if (!/\.docx$/i.test(file.name)) {
        throw new Error("Apenas arquivos .docx sao aceitos");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const report = validateTemplateBuffer(buffer);
      const meta = inferMeta(file.name);
      const processingType = detectProcessingType(file.name);
      const fileName = safeStorageFileName(`${Date.now()}_${file.name}`);
      const arquivoPath = await saveStorageBuffer(
        "templates",
        fileName,
        buffer,
        file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      const key = normalizeTemplateName(nome);
      const existente = existingByName.get(key);
      if (existente) {
        await prisma.template.update({
          where: { id: existente.id },
          data: {
            nome,
            tipo: meta.tipo,
            padraoHeader: meta.padraoHeader,
            processingType,
            arquivoPath,
            ativo: true,
          },
        });
        results.push({
          nome,
          status: "atualizado",
          tipo: meta.tipo,
          variaveis: report.variaveis.length,
          errosValidacao: report.issues.filter((issue) => issue.level === "error").length,
        });
      } else {
        const created = await prisma.template.create({
          data: {
            nome,
            tipo: meta.tipo,
            padraoHeader: meta.padraoHeader,
            processingType,
            arquivoPath,
            ativo: true,
          },
        });
        existingByName.set(key, created);
        results.push({
          nome,
          status: "importado",
          tipo: meta.tipo,
          variaveis: report.variaveis.length,
          errosValidacao: report.issues.filter((issue) => issue.level === "error").length,
        });
      }
    } catch (error) {
      results.push({
        nome,
        status: "erro",
        error: error instanceof Error ? error.message : "Erro ao importar template",
      });
    }
  }

  return NextResponse.json({
    total: files.length,
    results,
  });
}
