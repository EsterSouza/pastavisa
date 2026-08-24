import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import sharp from "sharp";
import { applyBatchChanges } from "@/lib/header-footer-replace";
import { montarDocx, paragrafo, run } from "./docx-fixture";

/**
 * Documento que saiu da geração com o `{cliente_logo}` cru no cabeçalho.
 *
 * A troca de logo em lote foi escrita para o caso normal — a logo já é uma imagem,
 * e o que muda são os bytes da mídia. Mas quando a geração não injetou a logo, o
 * arquivo finalizado carrega o marcador em texto: não há imagem para trocar, e a
 * rodada relatava sucesso deixando o `{cliente_logo}` escrito no cabeçalho do
 * documento entregue. Aqui o lote injeta a imagem no lugar do marcador.
 */

const CELULA_COM_MARCADOR =
  "<w:tbl><w:tr><w:tc>" +
  '<w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>' +
  paragrafo(run("{cliente_logo}")) +
  "</w:tc></w:tr></w:tbl>";

async function logoNova(): Promise<Buffer> {
  return sharp({
    create: { width: 300, height: 100, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
}

function header1(buffer: Buffer): string {
  return new PizZip(buffer).files["word/header1.xml"].asText();
}

describe("logo em documento que ainda tem o marcador", () => {
  it("injeta a imagem no lugar do {cliente_logo} e relata a troca", async () => {
    const entrada = montarDocx({ header1: CELULA_COM_MARCADOR });

    const { buffer, logoSubstituida } = await applyBatchChanges(entrada, {
      logoBuffer: await logoNova(),
    });

    const header = header1(buffer);
    expect(logoSubstituida).toBe(true);
    expect(header).not.toContain("{cliente_logo}");
    expect(header).toContain("<w:drawing>");
    expect(header).toContain('name="logo_cliente"');
  });

  it("pinta o fundo da célula que acabou de receber a imagem", async () => {
    const entrada = montarDocx({ header1: CELULA_COM_MARCADOR });

    const { buffer, logoFundoAplicado } = await applyBatchChanges(entrada, {
      logoBuffer: await logoNova(),
      logoBgHex: "#1B4332",
    });

    expect(logoFundoAplicado).toBe(true);
    expect(header1(buffer)).toContain('<w:shd w:val="clear" w:color="auto" w:fill="1B4332"/>');
  });

  it("pinta o fundo do marcador mesmo sem logo nova, e uma vez só", async () => {
    const entrada = montarDocx({ header1: CELULA_COM_MARCADOR });

    const { buffer, logoFundoAplicado } = await applyBatchChanges(entrada, {
      logoBgHex: "1b4332",
    });

    const header = header1(buffer);
    expect(logoFundoAplicado).toBe(true);
    // O marcador segue lá — sem logo enviada não há o que injetar —, mas a caixinha
    // já é da cor pedida, e as duas varreduras de fundo não empilham dois shadings.
    expect(header).toContain("{cliente_logo}");
    expect(header.match(/<w:shd\b/g)).toHaveLength(1);
  });

  it("não inventa imagem quando o documento não tem marcador nem logo desenhada", async () => {
    const entrada = montarDocx({ header1: paragrafo(run("cabecalho sem logo")) });

    const { buffer, logoSubstituida } = await applyBatchChanges(entrada, {
      logoBuffer: await logoNova(),
    });

    expect(logoSubstituida).toBe(false);
    expect(header1(buffer)).not.toContain("<w:drawing>");
  });
});
