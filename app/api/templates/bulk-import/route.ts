import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { detectProcessingType } from "@/lib/classifier";
import { safeStorageFileName, saveStorageBuffer, storageDriver } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TEMPLATES_SRC_DIR = path.join(process.cwd(), "TODOS_OS_TEMPLATES_PastaVISA");
const SUPABASE_TEMPLATE_PREFIX = "storage/templates";

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

function cleanTemplateName(file: string): string {
  return file
    .replace(/^bulk_\d+_/i, "")
    .replace(/^TEMPLATE_/i, "")
    .replace(/_/g, " ")
    .replace(/\.docx$/i, "");
}

function supabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function listSupabaseTemplateRefs(): Promise<Array<{ file: string; arquivoPath: string }>> {
  const supabase = supabaseAdminClient();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pasta-visa";
  if (!supabase) throw new Error("Supabase Storage nao configurado");

  const refs: Array<{ file: string; arquivoPath: string }> = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(SUPABASE_TEMPLATE_PREFIX, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const item of data) {
      if (!item.name.toLowerCase().endsWith(".docx")) continue;
      refs.push({
        file: item.name,
        arquivoPath: `supabase://${bucket}/${SUPABASE_TEMPLATE_PREFIX}/${item.name}`,
      });
    }

    if (data.length < 1000) break;
    offset += data.length;
  }

  return refs;
}

async function listLocalTemplateRefs(): Promise<Array<{ file: string; arquivoPath: string }>> {
  if (!fs.existsSync(TEMPLATES_SRC_DIR)) {
    throw new Error("Pasta TODOS_OS_TEMPLATES_PastaVISA nao encontrada no servidor");
  }

  const files = fs.readdirSync(TEMPLATES_SRC_DIR).filter((f) => f.toLowerCase().endsWith(".docx"));
  const refs: Array<{ file: string; arquivoPath: string }> = [];

  for (const file of files) {
    const srcPath = path.join(TEMPLATES_SRC_DIR, file);
    const destFileName = `bulk_${Date.now()}_${safeStorageFileName(file)}`;
    const arquivoPath = await saveStorageBuffer(
      "templates",
      destFileName,
      fs.readFileSync(srcPath),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    refs.push({ file, arquivoPath });
  }

  return refs;
}

export async function POST() {
  let refs: Array<{ file: string; arquivoPath: string }>;
  try {
    refs = storageDriver() === "supabase"
      ? await listSupabaseTemplateRefs()
      : await listLocalTemplateRefs();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao listar templates" },
      { status: 500 }
    );
  }

  const results: Array<{ nome: string; status: string; id?: string }> = [];

  for (const ref of refs) {
    const nomeLimpo = cleanTemplateName(ref.file);

    const existing = await prisma.template.findFirst({ where: { nome: nomeLimpo } });
    if (existing) {
      results.push({ nome: nomeLimpo, status: "ja existe", id: existing.id });
      continue;
    }

    try {
      const { tipo, padraoHeader } = inferMeta(ref.file);
      const processingType = detectProcessingType(ref.file);

      const template = await prisma.template.create({
        data: { nome: nomeLimpo, tipo, padraoHeader, processingType, arquivoPath: ref.arquivoPath },
      });

      results.push({ nome: nomeLimpo, status: "importado", id: template.id });
    } catch (err) {
      results.push({ nome: nomeLimpo, status: `erro: ${err instanceof Error ? err.message : "desconhecido"}` });
    }
  }

  return NextResponse.json({ total: refs.length, results });
}
