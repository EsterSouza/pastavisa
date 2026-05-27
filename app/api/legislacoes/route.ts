import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { criarChaveReferencia, encontrarReferenciaDuplicada } from "@/lib/reference-deduplication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const EDITABLE_FIELDS = ["estadoUf", "municipio", "tipo", "titulo", "referenciaAbnt", "destaqueAbnt", "ativo"] as const;

interface LegislacaoInput {
  estadoUf?: string;
  municipio?: string | null;
  tipo?: string;
  titulo?: string;
  referenciaAbnt?: string;
  destaqueAbnt?: string | null;
  ativo?: boolean;
}

function editableData(body: Record<string, unknown>): LegislacaoInput {
  return Object.fromEntries(
    EDITABLE_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]])
  ) as LegislacaoInput;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // estado/municipio params kept for backward compat (processar page uses ?estado=XX)
  const estado = searchParams.get("estado");
  const municipio = searchParams.get("municipio");
  const ids = (searchParams.get("ids") || "").split(",").filter(Boolean);

  const where: Record<string, unknown> = {};
  if (estado) {
    // processar page: return BR (federal) + matching state + matching municipal
    where.OR = [
      { estadoUf: "BR" },
      { estadoUf: estado },
      ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
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
  try {
    const body = editableData(await req.json());
    if (!body.estadoUf?.trim() || !body.tipo?.trim() || !body.titulo?.trim() || !body.referenciaAbnt?.trim()) {
      return NextResponse.json({ error: "UF, tipo, título e referência ABNT são obrigatórios." }, { status: 400 });
    }
    const existing = await prisma.legislacao.findMany();
    const duplicate = encontrarReferenciaDuplicada(body, existing);
    if (duplicate) {
      return NextResponse.json(
        { error: `Esta referência parece já estar cadastrada como "${duplicate.titulo}".`, duplicateId: duplicate.id },
        { status: 409 }
      );
    }
    const leg = await prisma.legislacao.create({
      data: {
        estadoUf: body.estadoUf,
        municipio: body.municipio || null,
        tipo: body.tipo,
        titulo: body.titulo,
        referenciaAbnt: body.referenciaAbnt,
        destaqueAbnt: body.destaqueAbnt || null,
        ativo: body.ativo ?? true,
        chaveReferencia: criarChaveReferencia(body),
      },
    });
    return NextResponse.json(leg, { status: 201 });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json({ error: "Esta referência já está cadastrada." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao salvar referência." }, { status: 500 });
  }
}
