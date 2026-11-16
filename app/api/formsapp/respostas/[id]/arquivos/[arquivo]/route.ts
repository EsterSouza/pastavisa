import { NextResponse } from "next/server";
import sharp from "sharp";
import { arquivoDaResposta, FormsAppErro } from "@/lib/formsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A resposta de uma função na Vercel para em 4,5 MB; foto maior vira JPEG menor.
const LIMITE = 4 * 1024 * 1024;

export async function GET(_req: Request, { params }: { params: { id: string; arquivo: string } }) {
  try {
    const baixado = await arquivoDaResposta(params.id, params.arquivo);
    let { nome, tipo } = baixado;
    let corpo: Buffer = Buffer.from(baixado.conteudo);
    if (corpo.length > LIMITE && tipo.startsWith("image/")) {
      corpo = await sharp(corpo).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      nome = nome.replace(/\.[^.]+$/, "") + ".jpg";
      tipo = "image/jpeg";
    }
    if (corpo.length > LIMITE) {
      return NextResponse.json(
        { error: `${nome} passa de 4 MB. Baixe pelo painel do forms.app ou pela pasta do Drive.` },
        { status: 413 }
      );
    }
    return new NextResponse(new Uint8Array(corpo), {
      headers: { "Content-Type": tipo, "X-Nome-Arquivo": encodeURIComponent(nome), "Cache-Control": "no-store" },
    });
  } catch (error) {
    const mensagem = error instanceof FormsAppErro ? error.message : "Não deu para baixar o arquivo do forms.app.";
    if (!(error instanceof FormsAppErro)) console.error("[formsapp] arquivo", error);
    return NextResponse.json({ error: mensagem }, { status: 502 });
  }
}
