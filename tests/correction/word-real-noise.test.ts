import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { planejarSubstituicoes } from "@/lib/docx-replacement-plan";
import { applyBatchChanges } from "@/lib/header-footer-replace";
import { validateDocxBuffer } from "@/lib/docx-validator";

/**
 * O XML que o Word realmente emite é muito mais sujo que um fixture mínimo:
 * rsids em todo elemento, `<w:proofErr>` cortando palavras ao meio, bookmarks,
 * quebras de página renderizadas, campos, tabulações entre runs e tabelas
 * aninhadas depois de um parágrafo vazio auto-fechado — a combinação que já
 * destruiu documento em produção.
 *
 * Este teste fixa o comportamento contra esse ruído: o texto certo muda, e
 * absolutamente nada em volta é tocado.
 */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

// Razão social partida ao meio da palavra por um <w:proofErr>, com fontes e
// negrito por run e um sufixo que precisa sobreviver.
const PARAGRAFO_REAL = `
<w:p w:rsidR="00A1B2C3" w:rsidRDefault="00A1B2C3" w:rsidP="00D4E5F6">
  <w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial"/><w:b/></w:rPr></w:pPr>
  <w:bookmarkStart w:id="0" w:name="_GoBack"/>
  <w:r w:rsidRPr="00A1B2C3"><w:rPr><w:rFonts w:ascii="Arial"/><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">CLINICA </w:t></w:r>
  <w:proofErr w:type="spellStart"/>
  <w:r w:rsidRPr="00A1B2C3"><w:rPr><w:rFonts w:ascii="Arial"/><w:b/></w:rPr><w:t>ANTI</w:t></w:r>
  <w:proofErr w:type="spellEnd"/>
  <w:r><w:rPr><w:rFonts w:ascii="Arial"/></w:rPr><w:t>GA LTDA ME</w:t></w:r>
  <w:bookmarkEnd w:id="0"/>
  <w:r><w:lastRenderedPageBreak/><w:t xml:space="preserve"> - filial</w:t></w:r>
</w:p>`;

// Campo de referência: `<w:instrText>` não é texto visível e não pode ser tocado.
const PARAGRAFO_CAMPO = `
<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:instrText xml:space="preserve"> REF CLINICA ANTIGA LTDA ME \\h </w:instrText></w:r>
<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;

// Tabulação entre runs: o par digitado com espaço precisa casar assim mesmo.
const PARAGRAFO_TAB = `
<w:p><w:r><w:t>CNPJ:</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>00.000.000/0001-00</w:t></w:r></w:p>`;

// Parágrafo vazio auto-fechado imediatamente antes de tabela aninhada.
const TABELA_ANINHADA = `
<w:p w:rsidR="00A1B2C3"/>
<w:tbl><w:tr><w:tc><w:tcPr><w:tcW w:w="4000"/></w:tcPr>
  <w:tbl><w:tr><w:tc><w:p><w:r><w:t>CLINICA ANTIGA LTDA ME na tabela interna</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
  <w:p><w:r><w:t>rodape da celula</w:t></w:r></w:p>
</w:tc></w:tr></w:tbl>`;

function montarDocumentoRuidoso(): Buffer {
  const zip = new PizZip();
  const corpo = PARAGRAFO_REAL + PARAGRAFO_CAMPO + PARAGRAFO_TAB + TABELA_ANINHADA;

  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/></Types>'
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
    `<w:document ${W} ${R}><w:body>${corpo}` +
      '<w:sectPr><w:headerReference w:type="default" r:id="rId10"/></w:sectPr></w:body></w:document>'
  );
  zip.file(
    "word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      "</Relationships>"
  );
  zip.file(
    "word/header1.xml",
    `<w:hdr ${W} ${R}><w:p><w:r><w:t>CLINICA ANTIGA LTDA ME</w:t></w:r></w:p></w:hdr>`
  );

  return zip.generate({ type: "nodebuffer" }) as Buffer;
}

const PARES = [
  { de: "CLINICA ANTIGA LTDA ME", para: "CLINICA NOVA LTDA" },
  { de: "CNPJ: 00.000.000/0001-00", para: "CNPJ: 11.111.111/0001-11" },
];

describe("substituição em documento com ruído real do Word", () => {
  it("troca o texto certo e preserva todo o resto da estrutura", async () => {
    const docx = montarDocumentoRuidoso();

    const resultado = await applyBatchChanges(docx, { substituicoes: PARES });
    const zip = new PizZip(resultado.buffer);
    const doc = zip.files["word/document.xml"].asText();
    const cabecalho = zip.files["word/header1.xml"].asText();

    // O pacote continua abrindo como .docx íntegro.
    expect(validateDocxBuffer(resultado.buffer).issues).toEqual([]);

    // O texto pretendido mudou, inclusive partido ao meio por <w:proofErr>.
    expect(doc).toContain("CLINICA NOVA LTDA");
    expect(cabecalho).toContain("CLINICA NOVA LTDA");
    expect(doc).toContain("- filial");

    // Nada em volta foi tocado.
    expect(doc).toContain("<w:b/>");
    expect(doc).toContain('w:rsidRPr="00A1B2C3"');
    expect(doc).toContain("_GoBack");
    expect(doc).toContain('w:type="spellStart"');
    expect(doc).toContain("<w:lastRenderedPageBreak/>");
    expect(doc).toContain("<w:tab/>");

    // Campo de referência não é texto visível e não pode ter sido substituído.
    expect(doc).toContain("REF CLINICA ANTIGA LTDA ME");

    // Tabela aninhada depois de parágrafo auto-fechado continua de pé.
    expect(doc.match(/<w:tbl>/g)).toHaveLength(2);
    expect(doc).toContain("na tabela interna");
    expect(doc).toContain("rodape da celula");
  });

  it("casa o par mesmo quando o texto está separado por tabulação", async () => {
    const docx = montarDocumentoRuidoso();

    const resultado = await applyBatchChanges(docx, { substituicoes: PARES });
    const doc = new PizZip(resultado.buffer).files["word/document.xml"].asText();

    expect(doc).toContain("11.111.111/0001-11");
    expect(doc).toContain("<w:tab/>");
  });

  it("a contagem prevista é exatamente a contagem aplicada", async () => {
    const docx = montarDocumentoRuidoso();

    const plano = planejarSubstituicoes(docx, PARES);
    const resultado = await applyBatchChanges(docx, { substituicoes: PARES });

    // Razão social: parágrafo partido + tabela interna + cabeçalho. O campo
    // <w:instrText> não conta, porque não é texto visível.
    expect(plano.substituicoes[0]).toMatchObject({ total: 3, corpo: 2, cabecalho: 1 });
    expect(plano.substituicoes[1].total).toBe(1);
    expect(resultado.contagens.map((s) => s.total)).toEqual(
      plano.substituicoes.map((s) => s.total)
    );
  });
});
