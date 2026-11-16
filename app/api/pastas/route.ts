import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pastas = await prisma.pasta.findMany({
    orderBy: { criadaEm: "desc" },
    include: {
      documentos: {
        select: { id: true, status: true },
      },
    },
  });
  // A lista avisa quando uma pasta impressa ainda não teve as páginas contadas.
  const contadas = new Set(
    (await prisma.contagemPaginas.findMany({ select: { pastaId: true } })).map((c: { pastaId: string | null }) => c.pastaId)
  );
  return NextResponse.json(pastas.map((p: { id: string }) => ({ ...p, paginasContadas: contadas.has(p.id) })));
}
