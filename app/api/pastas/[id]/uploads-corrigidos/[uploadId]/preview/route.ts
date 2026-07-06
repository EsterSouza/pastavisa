import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertDocxBufferToPreviewHtml } from "@/lib/docx-preview";
import { readStorageBuffer, storageFileExists } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  const doc = await prisma.documentoUpload.findFirst({
    where: { id: params.uploadId, pastaId: params.id },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento nao encontrado" }, { status: 404 });
  }

  const versaoId = req.nextUrl.searchParams.get("versaoId");
  const versao = versaoId
    ? await prisma.documentoUploadVersao.findFirst({
        where: { id: versaoId, documentoUploadId: doc.id },
      })
    : null;
  if (versaoId && !versao) {
    return NextResponse.json({ error: "Versao nao encontrada" }, { status: 404 });
  }

  const outputPath = versao?.outputPath || doc.outputPath || doc.uploadPath;
  if (!outputPath || !(await storageFileExists(outputPath))) {
    return NextResponse.json({ error: "Arquivo nao encontrado" }, { status: 404 });
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
