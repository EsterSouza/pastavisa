import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { fileNameFromStorageRef, readStorageBuffer, saveStorageBuffer } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const original = await prisma.template.findUnique({ where: { id: params.id } });
  if (!original) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const ext = path.extname(fileNameFromStorageRef(original.arquivoPath)) || ".docx";
  const destFileName = `copy_${Date.now()}${ext}`;

  let destPath: string;
  try {
    const sourceBuffer = await readStorageBuffer(original.arquivoPath);
    destPath = await saveStorageBuffer(
      "templates",
      destFileName,
      sourceBuffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  } catch {
    return NextResponse.json({ error: "Falha ao copiar arquivo" }, { status: 500 });
  }

  const copy = await prisma.template.create({
    data: {
      nome: `Cópia — ${original.nome}`,
      tipo: original.tipo,
      padraoHeader: original.padraoHeader,
      processingType: original.processingType,
      arquivoPath: destPath,
      ativo: false, // start inactive so user can review before activating
    },
  });

  return NextResponse.json(copy, { status: 201 });
}
