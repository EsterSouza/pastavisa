import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer } from "@/lib/file-storage";
import { extractDocxTextFromBuffer } from "@/lib/extractor";
import { associarLegislacoesDoDocumento } from "@/lib/legislation-matcher";
import { detectarReferenciasNaoCadastradas } from "@/lib/reference-extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const pasta = await prisma.pasta.findUnique({
      where: { id: params.id },
      select: { documentosElaboracaoPath: true, clienteEstado: true, clienteCidade: true },
    });
    if (!pasta) {
      return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
    }
    if (!pasta.documentosElaboracaoPath) {
      return NextResponse.json({ error: "Esta pasta não possui Documento em Elaboração salvo." }, { status: 400 });
    }

    const [buffer, legislacoes, todasLegislacoes] = await Promise.all([
      readStorageBuffer(pasta.documentosElaboracaoPath),
      prisma.legislacao.findMany({ where: { ativo: true } }),
      prisma.legislacao.findMany(),
    ]);
    const text = await extractDocxTextFromBuffer(buffer);
    const scope = {
      estadoUf: pasta.clienteEstado,
      municipio: pasta.clienteCidade,
    };
    const associadas = associarLegislacoesDoDocumento(text, legislacoes, scope);
    const referenciasNaoCadastradas = detectarReferenciasNaoCadastradas(text, todasLegislacoes, scope);

    await prisma.pasta.update({
      where: { id: params.id },
      data: { legislacaoIds: JSON.stringify(associadas.map((legislacao) => legislacao.id)) },
    });

    return NextResponse.json({ legislacoes: associadas, referenciasNaoCadastradas });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao associar referências";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
