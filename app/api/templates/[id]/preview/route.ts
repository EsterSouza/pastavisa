import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertDocxBufferToPreviewHtml } from "@/lib/docx-preview";
import { readStorageBuffer, storageFileExists } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const template = await prisma.template.findUnique({ where: { id: params.id } });
  if (!template) {
    return NextResponse.json({ error: "Template nao encontrado" }, { status: 404 });
  }

  if (!template.arquivoPath || !(await storageFileExists(template.arquivoPath))) {
    return NextResponse.json({ error: "Arquivo do template nao encontrado" }, { status: 404 });
  }

  const preview = await convertDocxBufferToPreviewHtml(await readStorageBuffer(template.arquivoPath));

  return NextResponse.json({
    html: preview.html,
    messages: preview.messages,
    nome: template.nome,
  });
}
