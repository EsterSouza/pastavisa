import { NextResponse } from "next/server";
import { FormsAppErro, respostaCompleta } from "@/lib/formsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF com as respostas e a lista das fotos e da logo, que vêm uma a uma. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { nome, nomePdf, pdf, arquivos } = await respostaCompleta(params.id);
    return NextResponse.json({ nome, nomePdf, pdf: Buffer.from(pdf).toString("base64"), arquivos });
  } catch (error) {
    const mensagem = error instanceof FormsAppErro ? error.message : "Não deu para ler a resposta do forms.app.";
    if (!(error instanceof FormsAppErro)) console.error("[formsapp] resposta", error);
    return NextResponse.json({ error: mensagem }, { status: 502 });
  }
}
