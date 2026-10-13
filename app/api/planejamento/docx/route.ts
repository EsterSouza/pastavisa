import { NextRequest, NextResponse } from "next/server";
import { contentDispositionHeader } from "@/lib/file-storage";
import { gerarDocxPlanejamento, nomeArquivoPlanejamento } from "@/lib/planejamento/docx";
import type { Planejamento } from "@/lib/planejamento/tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Gera o DOCX do planejamento revisado na tela. Nada é gravado: o arquivo vai direto para o download. */
export async function POST(req: NextRequest) {
  const plano = (await req.json().catch(() => null)) as Planejamento | null;
  if (!plano?.nomeCliente?.trim()) {
    return NextResponse.json({ error: "Falta o nome da cliente." }, { status: 400 });
  }
  try {
    const docx = await gerarDocxPlanejamento(plano);
    return new NextResponse(new Uint8Array(docx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": contentDispositionHeader(nomeArquivoPlanejamento(plano)),
      },
    });
  } catch (error) {
    console.error("[planejamento] DOCX falhou:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não deu para gerar o DOCX." },
      { status: 500 }
    );
  }
}
