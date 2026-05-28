import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteGeneratedDocx } from "@/lib/file-storage";
import { findBestTemplateMatch } from "@/lib/template-matcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeDocumentName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

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
    select: { id: true, nome: true, tipo: true, arquivoPath: true, processingType: true, padraoHeader: true, ativo: true, criadoEm: true },
  });
  const templateSelecionado = body.templateId
    ? templates.find((template) => template.id === body.templateId)
    : null;
  if (body.templateId && !templateSelecionado) {
    return NextResponse.json({ error: "Template ativo nao encontrado" }, { status: 404 });
  }

  const nomeArquivo = String(body.nomeArquivo || templateSelecionado?.nome || "").trim();
  if (!nomeArquivo) {
    return NextResponse.json({ error: "Nome do documento obrigatorio" }, { status: 400 });
  }

  const existentes = await prisma.documentoGerado.findMany({
    where: { pastaId: params.id },
    select: { nomeArquivo: true, templateId: true },
  });
  const normalizedName = normalizeDocumentName(nomeArquivo);
  const duplicated = existentes.some((doc) =>
    (templateSelecionado?.id && doc.templateId === templateSelecionado.id) ||
    normalizeDocumentName(doc.nomeArquivo) === normalizedName
  );
  if (duplicated) {
    return NextResponse.json({ error: "Este documento ja esta na pasta" }, { status: 409 });
  }

  const match = templateSelecionado ? null : findBestTemplateMatch(nomeArquivo, templates);
  const doc = await prisma.documentoGerado.create({
    data: {
      pastaId: params.id,
      nomeArquivo,
      status: "pendente",
      templateId: templateSelecionado?.id ?? match?.templateId,
    },
    include: { template: true },
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { docId } = await req.json();
    if (!docId) {
      return NextResponse.json({ error: "Documento obrigatório" }, { status: 400 });
    }

    const doc = await prisma.documentoGerado.findFirst({
      where: { id: docId, pastaId: params.id },
      select: { id: true, outputPath: true, versoes: { select: { outputPath: true } } },
    });
    if (!doc) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }

    const outputPaths = new Set([
      ...(doc.outputPath ? [doc.outputPath] : []),
      ...doc.versoes.map((versao) => versao.outputPath),
    ]);
    await Promise.all(Array.from(outputPaths).map((outputPath) => deleteGeneratedDocx(outputPath)));
    await prisma.documentoGerado.delete({ where: { id: doc.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao remover documento" },
      { status: 500 }
    );
  }
}
