import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { loadBrandAssets, type BrandAssets } from "./brand-assets";
import {
  ACADEMIC_REFERENCES_NOTE,
  AUTHORSHIP_NOTE,
  FEDERAL_REFERENCES,
  LOCAL_REFERENCES_NOTE,
  OUT_OF_FOLDER_NOTE,
  TECHNICAL_CRITERIA_NOTE,
} from "./references";
import { alertaSomenteComercial } from "./output";
import type { PlannerFormat, PlannerPrice } from "./pricing";
import type { PublicPlannerDocument } from "./types";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 52;
const CONTENT_WIDTH = A4.width - MARGIN * 2;
const FOOTER_TOP = 68;

// Paleta institucional do Manual de Marca TreinaVISA 2.0, a mesma de docs/DESIGN.md.
const NAVY_DEEP = rgb(7 / 255, 24 / 255, 46 / 255);
const NAVY = rgb(11 / 255, 31 / 255, 58 / 255);
const ACTION = rgb(36 / 255, 74 / 255, 155 / 255);
const FOCUS = rgb(111 / 255, 149 / 255, 246 / 255);
const PALE = rgb(234 / 255, 243 / 255, 252 / 255);
const AMBER = rgb(217 / 255, 151 / 255, 33 / 255);
const BORDER = rgb(206 / 255, 224 / 255, 243 / 255);
const INK_MUTED = rgb(57 / 255, 82 / 255, 114 / 255);
const WHITE = rgb(1, 1, 1);

export const WATERMARK_TEXT = "PRÉ-PLANEJAMENTO PROVISÓRIO";
export const OFFICIAL_CAVEAT =
  "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica. Este documento não é proposta contratual, não substitui a análise sanitária e não gera obrigação de execução.";

const FORMAT_LABEL: Record<PlannerFormat, string> = {
  digital: "Pasta digital",
  "preto-e-branco": "Pasta impressa em preto e branco + digital",
  colorida: "Pasta impressa colorida + digital",
};

export interface PlannerPdfData {
  cliente: string;
  municipio?: string;
  uf?: string;
  emitidoEm: Date;
  incluidos: string[];
  retirados: string[];
  documentos: PublicPlannerDocument[];
  preco: PlannerPrice;
  comparativo: PlannerPrice[];
  prazo: { diasUteis: number; sujeitoConfirmacaoTecnica: boolean };
  alertas: string[];
}

/** Sora e Source Sans cobrem o latino da marca; o resto sai para não abortar o download. */
function sanitize(value: string): string {
  return value
    .replace(/[‐-‒―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^ -ſ\u2013\u2014]/g, "")
    .trim();
}

function money(value: number): string {
  return sanitize(value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
}

function issuedAt(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of sanitize(text).split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

interface Fonts {
  display: PDFFont;
  displayStrong: PDFFont;
  body: PDFFont;
  bodyStrong: PDFFont;
}

export async function renderPlannerPdf(data: PlannerPdfData, assets?: BrandAssets): Promise<Uint8Array> {
  const brand = assets ?? (await loadBrandAssets());
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  async function font(bytes: Uint8Array | undefined, fallback: StandardFonts): Promise<PDFFont> {
    if (!bytes) return doc.embedFont(fallback);
    try {
      return await doc.embedFont(bytes, { subset: true });
    } catch {
      return doc.embedFont(fallback);
    }
  }

  const fonts: Fonts = {
    display: await font(brand.display, StandardFonts.Helvetica),
    displayStrong: await font(brand.displayStrong, StandardFonts.HelveticaBold),
    body: await font(brand.body, StandardFonts.Helvetica),
    bodyStrong: await font(brand.bodyStrong, StandardFonts.HelveticaBold),
  };
  const logo = brand.logo ? await doc.embedPng(brand.logo) : null;
  const cliente = sanitize(data.cliente);

  doc.setTitle(`Pré-planejamento comercial - ${cliente}`);
  doc.setSubject(WATERMARK_TEXT);
  doc.setAuthor("TreinaVISA");
  doc.setCreator("TreinaVISA - Pasta Sanitária");
  doc.setProducer("TreinaVISA - Pasta Sanitária");
  doc.setKeywords(["pré-planejamento", "provisório", "sujeito à validação da equipe técnica"]);
  doc.setCreationDate(data.emitidoEm);
  doc.setModificationDate(data.emitidoEm);

  let page: PDFPage = doc.addPage([A4.width, A4.height]);
  let cursor = 0;

  function watermark(target: PDFPage) {
    const size = 28;
    const text = sanitize(WATERMARK_TEXT);
    const width = fonts.displayStrong.widthOfTextAtSize(text, size);
    const diagonal = Math.SQRT1_2;
    target.drawText(text, {
      x: A4.width / 2 - (width / 2) * diagonal,
      y: A4.height / 2 - (width / 2) * diagonal,
      size,
      font: fonts.displayStrong,
      color: FOCUS,
      opacity: 0.1,
      rotate: degrees(45),
    });
  }

  function furniture(target: PDFPage, withBand: boolean) {
    watermark(target);

    if (withBand) {
      target.drawRectangle({ x: 0, y: A4.height - 126, width: A4.width, height: 126, color: NAVY_DEEP });
      target.drawRectangle({ x: 0, y: A4.height - 129, width: A4.width, height: 3, color: AMBER });
      if (logo) {
        const height = 25;
        target.drawImage(logo, {
          x: MARGIN,
          y: A4.height - 56,
          width: (logo.width / logo.height) * height,
          height,
        });
      } else {
        target.drawText("TreinaVISA", { x: MARGIN, y: A4.height - 54, size: 17, font: fonts.displayStrong, color: WHITE });
      }
      target.drawText(sanitize("Pré-planejamento comercial"), {
        x: MARGIN,
        y: A4.height - 101,
        size: 21,
        font: fonts.displayStrong,
        color: WHITE,
      });
      const produto = sanitize("Pasta Sanitária");
      target.drawText(produto, {
        x: A4.width - MARGIN - fonts.body.widthOfTextAtSize(produto, 11),
        y: A4.height - 97,
        size: 11,
        font: fonts.body,
        color: PALE,
      });
      cursor = A4.height - 129 - 44;
    } else {
      target.drawRectangle({ x: 0, y: A4.height - 44, width: A4.width, height: 44, color: NAVY_DEEP });
      target.drawText(sanitize(`Pré-planejamento comercial · ${cliente}`), {
        x: MARGIN,
        y: A4.height - 28,
        size: 9.5,
        font: fonts.body,
        color: PALE,
      });
      cursor = A4.height - 44 - 44;
    }

    target.drawLine({
      start: { x: MARGIN, y: FOOTER_TOP },
      end: { x: A4.width - MARGIN, y: FOOTER_TOP },
      thickness: 0.7,
      color: BORDER,
    });
    wrap(OFFICIAL_CAVEAT, fonts.body, 7.5, CONTENT_WIDTH - 80).forEach((line, index) => {
      target.drawText(line, {
        x: MARGIN,
        y: FOOTER_TOP - 15 - index * 10,
        size: 7.5,
        font: fonts.body,
        color: INK_MUTED,
      });
    });
  }

  function ensure(space: number) {
    if (cursor - space >= FOOTER_TOP + 26) return;
    page = doc.addPage([A4.width, A4.height]);
    furniture(page, false);
  }

  // `reserva` é a altura do primeiro bloco da seção: sem ela o título cabe no fim da
  // página e o conteúdo começa órfão na página seguinte.
  function heading(text: string, reserva = 22) {
    ensure(38 + reserva);
    cursor -= 10;
    page.drawText(sanitize(text), { x: MARGIN, y: cursor, size: 12, font: fonts.display, color: NAVY });
    cursor -= 10;
    page.drawLine({
      start: { x: MARGIN, y: cursor },
      end: { x: A4.width - MARGIN, y: cursor },
      thickness: 0.8,
      color: BORDER,
    });
    cursor -= 21;
  }

  function paragraph(text: string, options: { size?: number; color?: RGB; font?: PDFFont; gap?: number } = {}) {
    const size = options.size ?? 10.5;
    const font = options.font ?? fonts.body;
    for (const line of wrap(text, font, size, CONTENT_WIDTH)) {
      ensure(size + 5);
      page.drawText(line, { x: MARGIN, y: cursor, size, font, color: options.color ?? NAVY });
      cursor -= size + 4;
    }
    cursor -= options.gap ?? 4;
  }

  function bullets(items: string[], marker: RGB, size = 10.5) {
    const step = size + 3.5;
    for (const item of items) {
      const lines = wrap(item, fonts.body, size, CONTENT_WIDTH - 20);
      ensure(lines.length * step + 6);
      page.drawRectangle({ x: MARGIN + 1, y: cursor + 3, width: 3.5, height: 3.5, color: marker });
      lines.forEach((line, index) => {
        page.drawText(line, { x: MARGIN + 15, y: cursor - index * step, size, font: fonts.body, color: NAVY });
      });
      cursor -= lines.length * step + 5;
    }
    cursor -= 6;
  }

  furniture(page, true);

  // Identificação do cliente e data de emissão.
  page.drawRectangle({ x: MARGIN, y: cursor - 56, width: CONTENT_WIDTH, height: 72, color: PALE });
  page.drawRectangle({ x: MARGIN, y: cursor + 16, width: CONTENT_WIDTH, height: 2.5, color: ACTION });
  page.drawText("Cliente", { x: MARGIN + 20, y: cursor - 2, size: 9, font: fonts.body, color: INK_MUTED });
  page.drawText(wrap(cliente, fonts.displayStrong, 16, CONTENT_WIDTH - 220)[0], {
    x: MARGIN + 20,
    y: cursor - 24,
    size: 16,
    font: fonts.displayStrong,
    color: NAVY,
  });
  const local = sanitize([data.municipio, data.uf].filter(Boolean).join(" / ")) || "Local não informado";
  page.drawText(local, { x: MARGIN + 20, y: cursor - 44, size: 10, font: fonts.body, color: INK_MUTED });
  const emissao = sanitize(`Emitido em ${issuedAt(data.emitidoEm)}`);
  page.drawText(emissao, {
    x: A4.width - MARGIN - 20 - fonts.body.widthOfTextAtSize(emissao, 10),
    y: cursor - 44,
    size: 10,
    font: fonts.body,
    color: INK_MUTED,
  });
  cursor -= 82;

  heading(`Procedimentos considerados (${data.incluidos.length})`, 34);
  bullets(data.incluidos.length > 0 ? data.incluidos : ["Nenhum procedimento mantido."], ACTION);

  if (data.retirados.length > 0) {
    heading(`Procedimentos retirados a pedido do comercial (${data.retirados.length})`, 34);
    bullets(data.retirados, AMBER);
  }

  heading(`Documentos previstos (${data.documentos.length})`, 34);
  const tipoWidth = data.documentos.reduce(
    (maior, documento) =>
      Math.max(maior, fonts.bodyStrong.widthOfTextAtSize(sanitize(documento.tipo).toLocaleUpperCase("pt-BR"), 7.5) + 14),
    38
  );
  for (const documento of data.documentos) {
    const tipo = sanitize(documento.tipo).toLocaleUpperCase("pt-BR");
    const lines = wrap(documento.nome, fonts.body, 10.5, CONTENT_WIDTH - tipoWidth - 14);
    ensure(lines.length * 14 + 8);
    page.drawRectangle({
      x: MARGIN,
      y: cursor - 3.5,
      width: tipoWidth,
      height: 14.5,
      color: PALE,
      borderColor: BORDER,
      borderWidth: 0.5,
    });
    page.drawText(tipo, {
      x: MARGIN + (tipoWidth - fonts.bodyStrong.widthOfTextAtSize(tipo, 7.5)) / 2,
      y: cursor + 0.5,
      size: 7.5,
      font: fonts.bodyStrong,
      color: ACTION,
    });
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: MARGIN + tipoWidth + 12,
        y: cursor - index * 14,
        size: 10.5,
        font: fonts.body,
        color: NAVY,
      });
    });
    cursor -= lines.length * 14 + 7;
  }
  cursor -= 4;
  paragraph(`Contagem: ${data.documentos.length} documento(s) para ${data.incluidos.length} procedimento(s).`, {
    size: 10.5,
    font: fonts.bodyStrong,
  });
  paragraph(AUTHORSHIP_NOTE, { size: 9.5, color: INK_MUTED, gap: 2 });
  paragraph(OUT_OF_FOLDER_NOTE, { size: 9.5, color: INK_MUTED });

  heading("Investimento", 108);
  ensure(108);
  page.drawRectangle({ x: MARGIN, y: cursor - 78, width: CONTENT_WIDTH, height: 92, color: NAVY_DEEP });
  page.drawText(sanitize(FORMAT_LABEL[data.preco.formato]), {
    x: MARGIN + 20,
    y: cursor - 5,
    size: 11,
    font: fonts.display,
    color: PALE,
  });
  const composicao: Array<[string, string]> = [
    ["Valor base", money(data.preco.valorBase)],
    ["Adicional por volume acima de 100 procedimentos", money(data.preco.valorAdicional)],
  ];
  composicao.forEach(([rotulo, valor], index) => {
    const y = cursor - 28 - index * 15;
    page.drawText(sanitize(rotulo), { x: MARGIN + 20, y, size: 9.5, font: fonts.body, color: PALE });
    page.drawText(valor, {
      x: A4.width - MARGIN - 20 - fonts.body.widthOfTextAtSize(valor, 9.5),
      y,
      size: 9.5,
      font: fonts.body,
      color: PALE,
    });
  });
  page.drawText("Total", { x: MARGIN + 20, y: cursor - 66, size: 12, font: fonts.display, color: WHITE });
  const total = money(data.preco.valorTotal);
  page.drawText(total, {
    x: A4.width - MARGIN - 20 - fonts.displayStrong.widthOfTextAtSize(total, 17),
    y: cursor - 69,
    size: 17,
    font: fonts.displayStrong,
    color: WHITE,
  });
  cursor -= 100;

  paragraph("Formatos disponíveis", { size: 10.5, font: fonts.bodyStrong, gap: 3 });
  for (const opcao of data.comparativo) {
    ensure(18);
    const escolhido = opcao.formato === data.preco.formato;
    const font = escolhido ? fonts.bodyStrong : fonts.body;
    const color = escolhido ? NAVY : INK_MUTED;
    const rotulo = sanitize(`${escolhido ? "Formato escolhido: " : ""}${FORMAT_LABEL[opcao.formato]}`);
    const valor = money(opcao.valorTotal);
    page.drawText(rotulo, { x: MARGIN, y: cursor, size: 9.5, font, color });
    page.drawText(valor, {
      x: A4.width - MARGIN - font.widthOfTextAtSize(valor, 9.5),
      y: cursor,
      size: 9.5,
      font,
      color,
    });
    cursor -= 15;
  }
  cursor -= 8;

  heading("Prazo de entrega", 30);
  paragraph(
    data.prazo.sujeitoConfirmacaoTecnica
      ? `${data.prazo.diasUteis} dias úteis. Acima de 100 procedimentos, o prazo fica sujeito à confirmação técnica.`
      : `${data.prazo.diasUteis} dias úteis.`
  );

  heading("Referências normativas de base", 40);
  bullets([...FEDERAL_REFERENCES], ACTION, 9);
  paragraph(LOCAL_REFERENCES_NOTE, { size: 9.5, color: INK_MUTED, gap: 2 });
  paragraph(ACADEMIC_REFERENCES_NOTE, { size: 9.5, color: INK_MUTED });

  heading("Ressalva oficial", 56);
  paragraph(OFFICIAL_CAVEAT, { size: 9.5, color: INK_MUTED, gap: 2 });
  paragraph(TECHNICAL_CRITERIA_NOTE, { size: 9.5, color: INK_MUTED, gap: 8 });
  // Ressalva de legislação fica na tela do comercial e não neste documento.
  const impressos = data.alertas.filter((alerta) => !alertaSomenteComercial(alerta));
  if (impressos.length > 0) bullets(impressos, AMBER);

  // A numeração só pode ser escrita depois do fluxo, porque o total de páginas
  // só existe quando o conteúdo termina.
  const pages = doc.getPages();
  pages.forEach((target, index) => {
    const label = sanitize(`Página ${index + 1} de ${pages.length}`);
    target.drawText(label, {
      x: A4.width - MARGIN - fonts.body.widthOfTextAtSize(label, 7.5),
      y: FOOTER_TOP - 15,
      size: 7.5,
      font: fonts.body,
      color: INK_MUTED,
    });
  });

  return doc.save();
}
