import { NextRequest, NextResponse } from "next/server";
import { extractDocxTextFromBuffer } from "@/lib/extractor";
import { isManagedStorageReference, saveStorageBuffer } from "@/lib/file-storage";
import { associarLegislacoesDoDocumento } from "@/lib/legislation-matcher";
import { criarPasta } from "@/lib/pasta-criar";
import { prisma } from "@/lib/prisma";
import { gerarDocxPlanejamento } from "@/lib/planejamento/docx";
import { clienteDoPlanejamento, documentosDoPlanejamento } from "@/lib/planejamento/pasta";
import type { Planejamento } from "@/lib/planejamento/tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cria a pasta direto do planejamento revisado, sem IA: o DOCX é gerado do próprio
 * plano e guardado como "Documentos em elaboração" da pasta (prazos, cor da logo e
 * legislações saem dele como no fluxo antigo); os dados da cliente vêm do plano.
 */
export async function POST(req: NextRequest) {
  const corpo = (await req.json().catch(() => null)) as {
    plano?: Planejamento;
    formsRef?: string;
    /** Nome do documento → nome do template escolhido no rascunho. */
    templates?: Record<string, string>;
  } | null;
  const plano = corpo?.plano;
  if (!plano?.nomeCliente?.trim()) {
    return NextResponse.json({ error: "Falta o nome da cliente." }, { status: 400 });
  }
  const documentos = documentosDoPlanejamento(plano, corpo?.templates);
  if (documentos.length === 0) {
    return NextResponse.json({ error: "O planejamento não tem documentos para gerar." }, { status: 400 });
  }

  try {
    const docx = await gerarDocxPlanejamento(plano);
    const docxPath = await saveStorageBuffer(
      "uploads",
      `${Date.now()}_elaboracao.docx`,
      docx,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const texto = await extractDocxTextFromBuffer(docx);
    const data = clienteDoPlanejamento(plano, texto);

    const legislacoes = await prisma.legislacao.findMany({ where: { ativo: true } });
    const associadas = associarLegislacoesDoDocumento(texto, legislacoes, {
      estadoUf: data.clienteEstado,
      municipio: data.clienteCidade,
    });

    const pastaId = await criarPasta({
      pdfPath: isManagedStorageReference(corpo?.formsRef, "uploads") ? corpo!.formsRef : null,
      docxPath,
      data,
      documentosSelecionados: documentos,
      legislacaoIds: associadas.map((l) => l.id),
    });
    return NextResponse.json({ pastaId, documentos: documentos.length, legislacoes: associadas.length });
  } catch (error) {
    console.error("[planejamento] criar pasta falhou:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não deu para criar a pasta." },
      { status: 500 }
    );
  }
}
