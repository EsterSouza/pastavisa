import nodemailer from "nodemailer";
import { LOGO_TREINAVISA_PNG_BASE64 } from "./logo-treinavisa";

/**
 * Envio pela caixa da Hostinger, o mesmo SMTP do InspecVISA
 * (C:\Saas\App\supabase\functions\_shared\sendMail.ts). A senha fica só nas variáveis
 * de ambiente: SMTP_USER e SMTP_PASS (obrigatórias), SMTP_HOST e SMTP_PORT (padrão
 * smtp.hostinger.com:465), SMTP_FROM (nome do remetente) e SMTP_BCC (cópia oculta).
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

export async function enviarEmailHtml({ para, assunto, html }: { para: string; assunto: string; html: string }) {
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

  await transporte.sendMail({
    from: remetente(),
    to: para,
    bcc: process.env.SMTP_BCC || undefined,
    subject: assunto,
    html,
    text: textoSimples(html),
    attachments: [
      {
        filename: "treinavisa.png",
        content: Buffer.from(LOGO_TREINAVISA_PNG_BASE64, "base64"),
        contentType: "image/png",
        cid: "logo-treinavisa",
      },
    ],
  });
}
