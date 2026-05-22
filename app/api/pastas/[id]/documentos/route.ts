import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBestTemplateMatch } from "@/lib/template-matcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const docs = await prisma.documentoGerado.findMany({
    where: { pastaId: params.id },
    include: { template: true },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const templates = await prisma.template.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, tipo: true, arquivoPath: true },
  });
  const match = findBestTemplateMatch(body.nomeArquivo || "", templates);
  const doc = await prisma.documentoGerado.create({
    data: {
      pastaId: params.id,
      nomeArquivo: body.nomeArquivo,
      status: "pendente",
      templateId: body.templateId ?? match?.templateId,
    },
  });
  return NextResponse.json(doc, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { docId, ...data } = await req.json();
  const doc = await prisma.documentoGerado.update({
    where: { id: docId, pastaId: params.id },
    data,
  });
  return NextResponse.json(doc);
}
