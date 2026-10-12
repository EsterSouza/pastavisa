import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerPrazosDaPasta } from "@/lib/elaboracao-prazos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOTE = 8;

/**
 * Lê os prazos das pastas criadas antes da leitura automática. A lista de pastas
 * chama em lotes até `restantes` chegar a zero; cada pasta é lida uma vez só.
 */
export async function POST() {
  const pendentes = await prisma.pasta.findMany({
    where: { prazosLidosEm: null },
    select: { id: true },
    orderBy: { criadaEm: "desc" },
    take: LOTE,
  });

  for (const { id } of pendentes) {
    await lerPrazosDaPasta(id).catch((error) => console.warn(`[prazos] pasta ${id}:`, error));
  }

  const restantes = await prisma.pasta.count({ where: { prazosLidosEm: null } });
  return NextResponse.json({ lidas: pendentes.length, restantes });
}
