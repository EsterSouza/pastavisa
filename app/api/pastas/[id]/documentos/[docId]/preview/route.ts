import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertDocxBufferToPreviewHtml } from "@/lib/docx-preview";
import { readStorageBuffer, storageFileExists } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const preview = await convertDocxBufferToPreviewHtml(buffer);

  return NextResponse.json({
    html: preview.html,
    messages: preview.messages,
    nomeArquivo: doc.nomeArquivo,
    versaoId: versao?.id || null,
  });
}
