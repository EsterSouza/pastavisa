import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { definicaoEmail, montarEmail, problemasDoEmail } from "@/lib/emails/pasta-emails";
import { enviarEmailHtml, remetente, smtpConfigurado, type AnexoEmail } from "@/lib/emails/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O corpo da requisição na Vercel vai até 4,5 MB; o PDF vai em base64 (+33%). */
const ANEXO_MAXIMO = 3 * 1024 * 1024;

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Separa "a@x.com, b@y.com" em endereços; devolve null se algum não for e-mail. */
function destinatarios(para: string): string[] | null {
  const lista = para.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
  return lista.length > 0 && lista.every((item) => EMAIL.test(item)) ? lista : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const enviados = await prisma.emailEnviado.findMany({
    where: { pastaId: params.id },
    orderBy: { enviadoEm: "desc" },
  });
  return NextResponse.json({ smtpConfigurado: smtpConfigurado(), remetente: remetente(), enviados });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const tipo = typeof body?.tipo === "string" ? body.tipo : "";
  const definicao = definicaoEmail(tipo);
  if (!definicao) return NextResponse.json({ error: "Tipo de e-mail desconhecido." }, { status: 400 });

  const para = destinatarios(typeof body?.para === "string" ? body.para : "");
  if (!para) return NextResponse.json({ error: "Confira o e-mail da cliente." }, { status: 400 });

  const assunto = typeof body?.assunto === "string" ? body.assunto.trim() : "";
  if (!assunto) return NextResponse.json({ error: "Preencha o assunto." }, { status: 400 });

  const valores: Record<string, string> = {};
  for (const campo of definicao.campos) {
    const valor = body?.valores?.[campo.chave];
    valores[campo.chave] = typeof valor === "string" ? valor : "";
  }
  const problemas = problemasDoEmail(definicao.tipo, valores);
  if (problemas.length > 0) return NextResponse.json({ error: problemas.join(" ") }, { status: 400 });

  const anexos: AnexoEmail[] = [];
  if (body?.anexo) {
    const nome = typeof body.anexo.nome === "string" ? body.anexo.nome.trim() : "";
    const base64 = typeof body.anexo.base64 === "string" ? body.anexo.base64 : "";
    if (!/\.pdf$/i.test(nome) || !base64) {
      return NextResponse.json({ error: "O anexo precisa ser um PDF." }, { status: 400 });
    }
    const conteudo = Buffer.from(base64, "base64");
    if (conteudo.length > ANEXO_MAXIMO) {
      return NextResponse.json({ error: "O PDF passa de 3 MB. Mande pelo link do Drive." }, { status: 400 });
    }
    anexos.push({ nome, conteudo, tipo: "application/pdf" });
  }

  const pasta = await prisma.pasta.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!pasta) return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });

  let copiaEmEnviados = false;
  try {
    ({ copiaEmEnviados } = await enviarEmailHtml({
      para: para.join(", "),
      assunto,
      html: montarEmail(definicao.tipo, valores, "envio"),
      anexos,
    }));
  } catch (error) {
    console.error("[emails] envio falhou:", error);
    const detalhe = error instanceof Error ? error.message : "erro desconhecido";
    return NextResponse.json({ error: `O servidor de e-mail recusou o envio: ${detalhe}` }, { status: 502 });
  }

  const enviado = await prisma.emailEnviado.create({
    data: { pastaId: pasta.id, tipo: definicao.tipo, para: para.join(", "), assunto },
  });
  return NextResponse.json({ enviado, copiaEmEnviados });
}
