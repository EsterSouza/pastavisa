import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // estado/municipio params kept for backward compat (processar page uses ?estado=XX)
  const estado = searchParams.get("estado");
  const municipio = searchParams.get("municipio");

  const where: Record<string, unknown> = {};
  if (estado) {
    // processar page: return BR (federal) + matching state + matching municipal
    where.OR = [
      { estadoUf: "BR" },
      { estadoUf: estado },
    ];
  }
  if (municipio) where.municipio = municipio;

  const legislacoes = await prisma.legislacao.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: [{ estadoUf: "asc" }, { tipo: "asc" }, { titulo: "asc" }],
  });
  return NextResponse.json(legislacoes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const leg = await prisma.legislacao.create({ data: body });
  return NextResponse.json(leg, { status: 201 });
}
