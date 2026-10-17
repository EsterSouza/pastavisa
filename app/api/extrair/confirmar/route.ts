import { NextRequest, NextResponse } from "next/server";
import { criarPasta, type NovaPasta } from "@/lib/pasta-criar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body: NovaPasta = await req.json();

    if (!body.data || !body.documentosSelecionados) {
      return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 });
    }

    const pastaId = await criarPasta(body);
    return NextResponse.json({ pastaId });
  } catch (err) {
    console.error("Erro ao confirmar pasta:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
