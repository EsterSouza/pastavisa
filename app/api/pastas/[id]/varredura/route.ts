import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer, storageFileExists } from "@/lib/file-storage";
import { varrerDocx, type AlertaVarredura } from "@/lib/revisao/varredura";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Varredura sem modelo de todos os documentos gerados da pasta. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const pasta = await prisma.pasta.findUnique({
    where: { id: params.id },
    select: {
      clienteEstado: true,
      clienteCidade: true,
      documentos: {
        where: { status: "gerado" },
        select: { id: true, nomeArquivo: true, outputPath: true },
        orderBy: { nomeArquivo: "asc" },
      },
    },
  });
  if (!pasta) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  }

  const legislacoes = await prisma.legislacao.findMany();
  const escopo = { estadoUf: pasta.clienteEstado, municipio: pasta.clienteCidade };

  const documentos: Array<{ id: string; nomeArquivo: string; alertas: AlertaVarredura[] }> = [];
  for (const doc of pasta.documentos) {
    if (!doc.outputPath || !(await storageFileExists(doc.outputPath))) {
      documentos.push({
        id: doc.id,
        nomeArquivo: doc.nomeArquivo,
        alertas: [{ tipo: "estrutura", mensagem: "Arquivo gerado não encontrado no storage" }],
      });
      continue;
    }
    const buffer = await readStorageBuffer(doc.outputPath);
    const { alertas } = varrerDocx(buffer, { legislacoes, escopo });
    documentos.push({ id: doc.id, nomeArquivo: doc.nomeArquivo, alertas });
  }

  return NextResponse.json({ documentos });
}
