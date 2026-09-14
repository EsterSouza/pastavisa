import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { excluirPasta } from "@/lib/pasta-exclusao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Decisão da Ester em 14/09/2026: documento de cliente fica no máximo 30 dias
// depois de a pasta ser concluída. Excluir antes continua sendo pelo botão.
const DIAS_RETENCAO = 30;

/** Chamada todo dia pelo cron da Vercel (vercel.json). */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  // Sem segredo configurado a rota fica fechada: ela apaga pasta de cliente.
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const limite = new Date(Date.now() - DIAS_RETENCAO * 24 * 60 * 60 * 1000);
  const vencidas = await prisma.pasta.findMany({
    where: { status: "concluida", concluidaEm: { lte: limite } },
    select: { id: true },
  });

  const excluidas: string[] = [];
  const falhas: { id: string; erro: string }[] = [];
  for (const { id } of vencidas) {
    try {
      if (await excluirPasta(id)) excluidas.push(id);
    } catch (error) {
      falhas.push({ id, erro: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ excluidas, falhas }, { status: falhas.length ? 500 : 200 });
}
