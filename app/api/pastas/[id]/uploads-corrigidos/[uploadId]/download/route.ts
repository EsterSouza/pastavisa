import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOutputDocxFileName } from "@/lib/generator";
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
  const fileName = createOutputDocxFileName(doc.nomeArquivo);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
