import sharp from "sharp";
import type Anthropic from "@anthropic-ai/sdk";
import { extractDocxTextFromBuffer } from "@/lib/extractor";

// Os arquivos que a cliente mandou (formulário, outros PDFs, fotos, Word, texto)
// viram blocos para a IA ler juntos.

export interface Anexo {
  nome: string;
  conteudo: Buffer;
}

const IMAGEM = /\.(png|jpe?g|webp|gif|heic|heif|bmp|tiff?)$/i;

/** Lado maior das fotos: legível para a IA e abaixo do limite de 5 MB por imagem. */
const LADO_MAXIMO = 1800;

export async function blocosDosAnexos(anexos: Anexo[]): Promise<{
  blocos: Anthropic.Messages.ContentBlockParam[];
  ignorados: string[];
}> {
  const blocos: Anthropic.Messages.ContentBlockParam[] = [];
  const ignorados: string[] = [];

  for (const anexo of anexos) {
    const nome = anexo.nome;
    try {
      if (/\.pdf$/i.test(nome)) {
        blocos.push({ type: "text", text: `ARQUIVO: ${nome}` });
        blocos.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: anexo.conteudo.toString("base64") },
          title: nome,
        });
      } else if (IMAGEM.test(nome)) {
        const jpeg = await sharp(anexo.conteudo)
          .rotate()
          .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer();
        blocos.push({ type: "text", text: `ARQUIVO (foto): ${nome}` });
        blocos.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } });
      } else if (/\.docx$/i.test(nome)) {
        const texto = (await extractDocxTextFromBuffer(anexo.conteudo)).trim();
        blocos.push({ type: "text", text: `ARQUIVO (Word): ${nome}\n${texto || "(sem texto legível)"}` });
      } else if (/\.(txt|md|csv)$/i.test(nome)) {
        blocos.push({ type: "text", text: `ARQUIVO (texto): ${nome}\n${anexo.conteudo.toString("utf8")}` });
      } else {
        ignorados.push(nome);
      }
    } catch (error) {
      console.warn(`[planejamento] anexo não lido: ${nome}`, error);
      ignorados.push(nome);
    }
  }
  return { blocos, ignorados };
}
