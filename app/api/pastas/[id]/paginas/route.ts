import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerDocumentos } from "@/lib/contagem-paginas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const contagem = await prisma.contagemPaginas.findUnique({ where: { pastaId: params.id } });
  return NextResponse.json({ contagem });
}

/** Grava as páginas contadas no navegador; contar de novo substitui a contagem da pasta. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const documentos = lerDocumentos(body?.documentos);
  if (!documentos) return NextResponse.json({ error: "A lista de PDFs veio vazia ou com página inválida." }, { status: 400 });

  const pasta = await prisma.pasta.findUnique({
    where: { id: params.id },
    select: { clienteNomeFantasia: true, clienteRtNome: true, versaoPasta: true },
  });
  if (!pasta) return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });

  const dados = {
    cliente: pasta.clienteNomeFantasia || pasta.clienteRtNome || "Sem nome",
    versao: pasta.versaoPasta,
    paginas: documentos.reduce((soma, d) => soma + d.paginas, 0),
    documentos: JSON.stringify(documentos),
    contadaEm: new Date(),
  };
  const contagem = await prisma.contagemPaginas.upsert({
    where: { pastaId: params.id },
    create: { pastaId: params.id, ...dados },
    update: dados,
  });
  return NextResponse.json({ contagem });
}
