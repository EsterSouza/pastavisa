import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { ImapFlow } from "imapflow";
import { LOGO_TREINAVISA_PNG_BASE64 } from "./logo-treinavisa";

/**
 * Envio pela caixa da Hostinger, o mesmo SMTP do InspecVISA
 * (C:\Saas\App\supabase\functions\_shared\sendMail.ts). A senha fica só nas variáveis
 * de ambiente: SMTP_USER e SMTP_PASS (obrigatórias), SMTP_HOST e SMTP_PORT (padrão
 * smtp.hostinger.com:465), SMTP_FROM (nome do remetente) e SMTP_BCC (cópia oculta).
 * A cópia em "Enviados" usa IMAP_HOST e IMAP_PORT (padrão imap.hostinger.com:993).
 */

export function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function remetente(): string {
  const user = process.env.SMTP_USER || "";
  return process.env.SMTP_FROM || (user ? `TreinaVISA <${user}>` : "");
}

/** Versão em texto para o e-mail não cair no spam por ser só HTML. */
function textoSimples(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a [^>]*href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

/**
 * O SMTP só entrega; quem põe a mensagem em "Enviados" é o IMAP da mesma caixa
 * (imap.hostinger.com, mesma senha). Falhar aqui não desfaz o envio: só avisa.
 */
async function guardarEmEnviados(mensagem: Buffer, data: Date, user: string, pass: string): Promise<boolean> {
  const cliente = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.hostinger.com",
    port: Number(process.env.IMAP_PORT || "993"),
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  try {
    await cliente.connect();
    const pastas = await cliente.list();
    const enviados =
      pastas.find((p) => p.specialUse === "\\Sent") ||
      pastas.find((p) => /^(inbox\.)?(sent|enviados|itens enviados)$/i.test(p.path));
    if (!enviados) throw new Error(`pasta de enviados não encontrada (${pastas.map((p) => p.path).join(", ")})`);
    await cliente.append(enviados.path, mensagem, ["\\Seen"], data);
    return true;
  } catch (error) {
    console.error("[emails] não guardou em Enviados:", error);
    return false;
  } finally {
    await cliente.logout().catch(() => undefined);
  }
}

/** Envia e devolve se a cópia ficou em "Enviados" da caixa. */
export interface AnexoEmail {
  nome: string;
  conteudo: Buffer;
  tipo: string;
}

export async function enviarEmailHtml({
  para,
  assunto,
  html,
  anexos = [],
}: {
  para: string;
  assunto: string;
  html: string;
  /** Ex.: o PDF do planejamento no e-mail de boas-vindas. */
  anexos?: AnexoEmail[];
}): Promise<{ copiaEmEnviados: boolean }> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error("O envio de e-mail não está configurado (faltam SMTP_USER e SMTP_PASS).");

  const port = Number(process.env.SMTP_PORT || "465");
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const data = new Date();
  const mensagem: Mail.Options = {
    from: remetente(),
    to: para,
    subject: assunto,
    html,
    text: textoSimples(html),
    date: data,
    // Mesmo Message-ID no envio e na cópia de "Enviados".
    messageId: `<${randomUUID()}@${user.split("@")[1] || "treinavisa"}>`,
    attachments: [
      {
        filename: "treinavisa.png",
        content: Buffer.from(LOGO_TREINAVISA_PNG_BASE64, "base64"),
        contentType: "image/png",
        cid: "logo-treinavisa",
      },
      ...anexos.map((a) => ({ filename: a.nome, content: a.conteudo, contentType: a.tipo })),
    ],
  };

  await transporte.sendMail({ ...mensagem, bcc: process.env.SMTP_BCC || undefined });

  const copia = await new MailComposer(mensagem).compile().build();
  return { copiaEmEnviados: await guardarEmEnviados(copia, data, user, pass) };
}
