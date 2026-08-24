import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { applyLogoCellBackgroundInParts } from "@/lib/header-footer-replace";

/**
 * Cor de fundo da logo na correção em lote.
 *
 * Na geração a célula é achada pelo texto do marcador (`{cliente_logo}`), que só
 * existe enquanto o arquivo ainda é template. Aqui os documentos já saíram prontos:
 * o marcador não está mais lá, e a célula precisa ser achada pela imagem — a mesma
 * que a troca de logo elege. Estes testes fixam esse alvo e a inércia do no-op.
 */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const RELS_ABRE =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
const TIPO_IMAGEM = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

function desenho(rId: string): string {
  return (
    "<w:drawing><wp:inline><wp:extent cx=\"720000\" cy=\"684000\"/>" +
    "<a:graphic><a:graphicData><pic:pic><pic:blipFill>" +
    `<a:blip r:embed="${rId}"/>` +
    "</pic:blipFill></pic:pic></a:graphicData></a:graphic>" +
    "</wp:inline></w:drawing>"
  );
}

function celulaComDesenho(rId: string, tcPrExtra = ""): string {
  return (
    "<w:tbl><w:tr><w:tc>" +
    `<w:tcPr><w:tcW w:w="4000" w:type="dxa"/>${tcPrExtra}</w:tcPr>` +
    `<w:p><w:r>${desenho(rId)}</w:r></w:p>` +
    "</w:tc></w:tr></w:tbl>"
  );
}

function relacaoImagem(rId: string, target: string): string {
  return `<Relationship Id="${rId}" Type="${TIPO_IMAGEM}" Target="${target}"/>`;
}

interface Opcoes {
  /** Shading já presente na célula da logo, para provar a substituição. */
  tcPrExtra?: string;
}

/**
 * Cabeçalho vigente (header1) com uma foto solta de rId menor fora de célula e a
 * logo dentro da célula, mais um header2 que nenhum `<w:sectPr>` referencia.
 * A foto fica fora de célula de propósito: é ela que o alvo antigo (menor rId)
 * escolheria, e é dela que o fundo tem de passar longe.
 */
function montarDocxComLogo({ tcPrExtra }: Opcoes = {}): PizZip {
  const zip = new PizZip();

  zip.file(
    "word/document.xml",
    `<w:document ${W} ${R}><w:body><w:p><w:r><w:t>corpo</w:t></w:r></w:p>` +
      '<w:sectPr><w:headerReference w:type="default" r:id="rId10"/></w:sectPr>' +
      "</w:body></w:document>"
  );
  zip.file(
    "word/_rels/document.xml.rels",
    RELS_ABRE +
      '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rId20" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>' +
      "</Relationships>"
  );

  zip.file(
    "word/header1.xml",
    `<w:hdr ${W} ${R}><w:p><w:r>${desenho("rId5")}</w:r></w:p>` +
      `${celulaComDesenho("rId7", tcPrExtra)}</w:hdr>`
  );
  zip.file(
    "word/_rels/header1.xml.rels",
    RELS_ABRE +
      relacaoImagem("rId5", "media/foto.png") +
      relacaoImagem("rId7", "media/logo.png") +
      "</Relationships>"
  );

  zip.file("word/header2.xml", `<w:hdr ${W} ${R}>${celulaComDesenho("rId9")}</w:hdr>`);
  zip.file(
    "word/_rels/header2.xml.rels",
    RELS_ABRE + relacaoImagem("rId9", "media/antiga.png") + "</Relationships>"
  );

  return zip;
}

function xml(zip: PizZip, caminho: string): string {
  return zip.files[caminho].asText();
}

describe("cor de fundo da logo na correção em lote", () => {
  it("pinta a célula da logo, e não a imagem solta de rId menor", () => {
    const zip = montarDocxComLogo();

    expect(applyLogoCellBackgroundInParts(zip, "#1B4332")).toBe(true);

    const header = xml(zip, "word/header1.xml");
    const celulaLogo = (header.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).find((c) =>
      c.includes('r:embed="rId7"')
    )!;

    expect(celulaLogo).toContain('<w:shd w:val="clear" w:color="auto" w:fill="1B4332"/>');
    // A foto está fora de célula: nada foi pintado em volta dela.
    expect(header.match(/<w:shd\b/g)).toHaveLength(1);
  });

  it("não toca parte de cabeçalho que o corpo não referencia", () => {
    const zip = montarDocxComLogo();
    const antes = xml(zip, "word/header2.xml");

    applyLogoCellBackgroundInParts(zip, "#1B4332");

    expect(xml(zip, "word/header2.xml")).toBe(antes);
  });

  it("substitui o shading que já existia, sem empilhar dois", () => {
    const zip = montarDocxComLogo({
      tcPrExtra: '<w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>',
    });

    applyLogoCellBackgroundInParts(zip, "1b4332");

    const header = xml(zip, "word/header1.xml");
    expect(header.match(/<w:shd\b/g)).toHaveLength(1);
    expect(header).toContain('w:fill="1B4332"');
  });

  it("não mexe em nada quando a cor está vazia ou inválida", () => {
    for (const cor of ["", "   ", "#12345", "verde"]) {
      const zip = montarDocxComLogo();
      const antes = xml(zip, "word/header1.xml");

      expect(applyLogoCellBackgroundInParts(zip, cor)).toBe(false);
      expect(xml(zip, "word/header1.xml")).toBe(antes);
    }
  });
});
