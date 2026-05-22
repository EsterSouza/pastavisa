import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBestTemplateMatch } from "@/lib/template-matcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const overwrite = body.overwrite === true;

  const [docs, templates] = await Promise.all([
    prisma.documentoGerado.findMany({
      where: { pastaId: params.id },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.template.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, tipo: true, arquivoPath: true },
    }),
  ]);

  const updates: Array<{ docId: string; templateId: string | null; score: number | null }> = [];

  for (const doc of docs) {
    if (doc.templateId && !overwrite) continue;
    const match = findBestTemplateMatch(doc.nomeArquivo, templates);
    if (!match) {
      if (overwrite && doc.templateId) {
        updates.push({ docId: doc.id, templateId: null, score: null });
      }
      continue;
    }
    if (doc.templateId === match.templateId) continue;

    updates.push({ docId: doc.id, templateId: match.templateId, score: match.score });
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.documentoGerado.update({
        where: { id: update.docId, pastaId: params.id },
        data: { templateId: update.templateId },
      })
    )
  );

  const updatedDocs = await prisma.documentoGerado.findMany({
    where: { pastaId: params.id },
    include: { template: true },
    orderBy: { criadoEm: "asc" },
  });

  return NextResponse.json({
    atualizados: updates.length,
    matches: updates,
    documentos: updatedDocs,
  });
}
