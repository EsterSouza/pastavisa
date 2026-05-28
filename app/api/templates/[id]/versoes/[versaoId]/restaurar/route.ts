import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTemplateVersion,
  snapshotTemplateVersion,
  TemplateVersionUnavailableError,
} from "@/lib/template-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string; versaoId: string } }
) {
  try {
    const versao = await getTemplateVersion(params.id, params.versaoId);
    if (!versao) {
      return NextResponse.json({ error: "Versão não encontrada" }, { status: 404 });
    }

    await snapshotTemplateVersion(params.id, "Antes de restaurar versão anterior");
    const template = await prisma.template.update({
      where: { id: params.id },
      data: {
        nome: versao.nome,
        tipo: versao.tipo,
        padraoHeader: versao.padraoHeader,
        processingType: versao.processingType,
        arquivoPath: versao.arquivoPath,
        ativo: true,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof TemplateVersionUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Erro ao restaurar versão do template:", error);
    return NextResponse.json({ error: "Erro ao restaurar versão do template" }, { status: 500 });
  }
}
