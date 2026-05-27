import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer, storageFileExists } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizePreviewHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const doc = await prisma.documentoGerado.findFirst({
    where: { id: params.docId, pastaId: params.id },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento nao encontrado" }, { status: 404 });
  }

  const versaoId = req.nextUrl.searchParams.get("versaoId");
  const versao = versaoId
    ? await prisma.documentoVersao.findFirst({
        where: { id: versaoId, documentoId: doc.id },
      })
    : null;
  if (versaoId && !versao) {
    return NextResponse.json({ error: "Versao nao encontrada" }, { status: 404 });
  }

  const outputPath = versao?.outputPath || doc.outputPath;
  if (!outputPath || !(await storageFileExists(outputPath))) {
    return NextResponse.json({ error: "Arquivo gerado nao encontrado" }, { status: 404 });
  }

  const buffer = await readStorageBuffer(outputPath);
  const result = await mammoth.convertToHtml({ buffer });

  return NextResponse.json({
    html: sanitizePreviewHtml(result.value),
    messages: result.messages.map((message) => ({
      type: message.type,
      message: message.message,
    })),
    nomeArquivo: doc.nomeArquivo,
    versaoId: versao?.id || null,
  });
}
