import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Todas as contagens de páginas, da mais recente para a mais antiga (tela Impressões). */
export async function GET() {
  const contagens = await prisma.contagemPaginas.findMany({ orderBy: { contadaEm: "desc" } });
  return NextResponse.json({ contagens });
}
