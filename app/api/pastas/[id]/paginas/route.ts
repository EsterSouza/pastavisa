import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerDocumentos } from "@/lib/contagem-paginas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const contagem = await prisma.contagemPaginas.findUnique({ where: { pastaId: params.id } });
  return NextResponse.json({ contagem });
}

/**
 * Grava as páginas contadas no navegador; contar de novo substitui as páginas.
 * A data (contadaEm) é o dia da impressão: nasce no dia da contagem, recontar
 * não mexe nela, e a Ester corrige pelo PATCH quando conta uma pasta antiga.
 */
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
  };
  const contagem = await prisma.contagemPaginas.upsert({
    where: { pastaId: params.id },
    create: { pastaId: params.id, ...dados, contadaEm: new Date() },
    update: dados,
  });
  return NextResponse.json({ contagem });
}

/** Muda o dia da impressão, que decide o ciclo da franquia. Recebe AAAA-MM-DD. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const dia = typeof body?.impressaEm === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.impressaEm) ? body.impressaEm : null;
  // Meio-dia em Brasília (15h UTC): o dia não muda com o fuso de quem lê.
  const data = dia ? new Date(`${dia}T15:00:00Z`) : null;
  if (!data || Number.isNaN(data.getTime()) || data.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Data de impressão inválida." }, { status: 400 });
  }
  const atual = await prisma.contagemPaginas.findUnique({ where: { pastaId: params.id }, select: { id: true } });
  if (!atual) return NextResponse.json({ error: "Conte as páginas antes de marcar a impressão." }, { status: 404 });
  const contagem = await prisma.contagemPaginas.update({ where: { id: atual.id }, data: { contadaEm: data } });
  return NextResponse.json({ contagem });
}
