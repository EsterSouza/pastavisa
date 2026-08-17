import PizZip from "pizzip";

/**
 * Construtor de .docx mínimos para os testes de correção: pacote pequeno, mas
 * íntegro o bastante para atravessar o validador (content types, relacionamentos
 * resolvíveis e XML bem formado).
 */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

export function run(texto: string, rPr = ""): string {
  return `<w:r>${rPr}<w:t>${texto}</w:t></w:r>`;
}

export function paragrafo(...runs: string[]): string {
  return `<w:p>${runs.join("")}</w:p>`;
}

export const DRAWING =
  '<w:drawing><wp:inline><wp:extent cx="100" cy="50"/>' +
  "<a:graphic><a:graphicData><pic:pic><pic:blipFill>" +
  '<a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic>' +
  "</wp:inline></w:drawing>";

const SECT_PR =
  '<w:sectPr><w:headerReference w:type="default" r:id="rId10"/>' +
  '<w:footerReference w:type="default" r:id="rId11"/></w:sectPr>';

function documento(corpo: string, sectPr: string): string {
  return `<w:document ${W} ${R}><w:body>${corpo}${sectPr}</w:body></w:document>`;
}

function parteSolta(corpo: string): string {
  return `<w:hdr ${W} ${R}>${corpo}</w:hdr>`;
}

export interface Partes {
  corpo?: string;
  header1?: string;
  footer1?: string;
  header2?: string;
  /** Quando falso, nenhum sectPr referencia cabeçalho ou rodapé. */
  comSectPr?: boolean;
}

export function montarDocx(partes: Partes = {}): Buffer {
  const zip = new PizZip();

  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/></Types>'
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>"
  );

  zip.file(
    "word/document.xml",
    documento(
      partes.corpo ?? paragrafo(run("corpo vazio")),
      partes.comSectPr === false ? "" : SECT_PR
    )
  );

  zip.file(
    "word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
      "</Relationships>"
  );

  zip.file("word/header1.xml", parteSolta(partes.header1 ?? paragrafo(run("cabecalho"))));
  zip.file("word/footer1.xml", parteSolta(partes.footer1 ?? paragrafo(run("rodape"))));
  if (partes.header2) zip.file("word/header2.xml", parteSolta(partes.header2));

  // Imagem referenciada pelo cabeçalho, para provar que desenhos e relações
  // sobrevivem à substituição de texto.
  zip.file("word/media/image1.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]), { binary: true });
  zip.file(
    "word/_rels/header1.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>' +
      "</Relationships>"
  );

  return zip.generate({ type: "nodebuffer" }) as Buffer;
}
