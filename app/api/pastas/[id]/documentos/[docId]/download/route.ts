import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOutputDocxFileName } from "@/lib/generator";
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
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  const versaoId = req.nextUrl.searchParams.get("versaoId");
  const versao = versaoId
    ? await prisma.documentoVersao.findFirst({
        where: { id: versaoId, documentoId: doc.id },
      })
    : null;
  if (versaoId && !versao) {
    return NextResponse.json({ error: "Versão não encontrada" }, { status: 404 });
  }

  const outputPath = versao?.outputPath || doc.outputPath;
  if (!outputPath || !(await storageFileExists(outputPath))) {
    return NextResponse.json({ error: "Arquivo gerado não encontrado" }, { status: 404 });
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
