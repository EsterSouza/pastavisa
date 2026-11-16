import { NextResponse } from "next/server";
import { FormsAppErro, listarRespostas } from "@/lib/formsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Respostas do formulário da Pasta Sanitária, da mais nova para a mais antiga. */
export async function GET() {
  try {
    return NextResponse.json({ respostas: await listarRespostas() });
  } catch (error) {
    const mensagem = error instanceof FormsAppErro ? error.message : "Não deu para consultar o forms.app.";
    if (!(error instanceof FormsAppErro)) console.error("[formsapp] lista", error);
    return NextResponse.json({ error: mensagem }, { status: 502 });
  }
}
