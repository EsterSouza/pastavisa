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
  chaveReferencia?: string;
}

function editableData(body: Record<string, unknown>): LegislacaoInput {
  return Object.fromEntries(
    EDITABLE_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]])
  ) as LegislacaoInput;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = editableData(await req.json());
    const current = await prisma.legislacao.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: "Referência não encontrada." }, { status: 404 });

    const changesIdentity = ["estadoUf", "municipio", "titulo", "referenciaAbnt"]
      .some((field) => Object.prototype.hasOwnProperty.call(body, field));
    const data = { ...current, ...body };
    if (changesIdentity) {
      const existing = await prisma.legislacao.findMany();
      const duplicate = encontrarReferenciaDuplicada(data, existing, params.id);
      if (duplicate) {
        return NextResponse.json(
          { error: `Esta referência parece duplicar "${duplicate.titulo}".`, duplicateId: duplicate.id },
          { status: 409 }
        );
      }
      body.chaveReferencia = criarChaveReferencia(data);
    }

    const leg = await prisma.legislacao.update({ where: { id: params.id }, data: body });
    return NextResponse.json(leg);
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json({ error: "Esta referência já está cadastrada." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao atualizar referência." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.legislacao.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
