import { NextRequest, NextResponse } from "next/server";
import { extractDocxTextFromBuffer } from "@/lib/extractor";
import { prisma } from "@/lib/prisma";
import { detectarReferenciasNaoCadastradas } from "@/lib/reference-extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("arquivo") as File | null;
    const estadoUf = (formData.get("estadoUf") as string | null) || undefined;
    const municipio = (formData.get("municipio") as string | null) || undefined;

    if (!file) {
      return NextResponse.json({ error: "Envie um arquivo .docx para analisar." }, { status: 400 });
    }
    if (!/\.docx$/i.test(file.name)) {
      return NextResponse.json({ error: "A importação aceita apenas arquivos .docx." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractDocxTextFromBuffer(buffer);
    const existentes = await prisma.legislacao.findMany();
    const referencias = detectarReferenciasNaoCadastradas(text, existentes, { estadoUf, municipio });

    return NextResponse.json({
      total: referencias.length,
      referencias,
      textoExtraidoPreview: text.slice(0, 700) || null,
    });
  } catch (error) {
    console.error("Erro ao importar legislações:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao importar legislações." },
      { status: 500 }
    );
  }
}
