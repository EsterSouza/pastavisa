import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { textoDaParte, varrerDocx } from "@/lib/revisao/varredura";

const CT = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

function docx(body: string, extra: Record<string, string> = {}): Buffer {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", CT);
  zip.file("_rels/.rels", RELS);
  zip.file("word/_rels/document.xml.rels", DOC_RELS);
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  );
  for (const [nome, conteudo] of Object.entries(extra)) zip.file(nome, conteudo);
  return zip.generate({ type: "nodebuffer" });
}

const p = (...runs: string[]) => `<w:p>${runs.map((t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`).join("")}</w:p>`;

describe("varrerDocx", () => {
  it("documento limpo não gera alerta", () => {
    const { alertas, texto } = varrerDocx(docx(p("Higienizar as mãos antes do atendimento.")));
    expect(alertas).toEqual([]);
    expect(texto).toBe("Higienizar as mãos antes do atendimento.");
  });

  it("junta runs e decodifica entidades", () => {
    expect(textoDaParte(p("Limpeza ", "&amp; ", "desinfecção") + "<w:p/>" + p("fim"))).toBe("Limpeza & desinfecção\n\nfim");
  });

  it("aponta variável que sobrou mesmo quebrada em runs", () => {
    const { alertas } = varrerDocx(docx(p("Responsável: {cliente_", "rt_nome}")));
    expect(alertas).toContainEqual({ tipo: "variavel", mensagem: "Variável não substituída: {cliente_rt_nome}" });
  });

  it("conta travessões e termos genéricos com trecho", () => {
    const { alertas } = varrerDocx(docx(p("A clínica — e a Clínica — usa autoclave.")));
    expect(alertas.find((a) => a.tipo === "travessao")?.mensagem).toBe("Travessão (—) 2 vez(es)");
    const clinica = alertas.find((a) => a.mensagem.startsWith('"clínica"'));
    expect(clinica?.mensagem).toBe('"clínica" 2x');
    expect(clinica?.trecho).toContain("A clínica");
    expect(alertas.some((a) => a.mensagem.startsWith('"autoclave"'))).toBe(true);
  });

  it("sigla em maiúsculas não casa palavra comum", () => {
    const { alertas } = varrerDocx(docx(p("O serviço é isento de taxa.")));
    expect(alertas.some((a) => a.mensagem.startsWith('"ISENTO"'))).toBe(false);
  });

  it("aponta numId e rId duplicados", () => {
    const numbering = `<?xml version="1.0" encoding="UTF-8"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:num w:numId="3"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="3"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
    const { alertas } = varrerDocx(docx(p("ok"), { "word/numbering.xml": numbering }));
    expect(alertas).toContainEqual({ tipo: "estrutura", mensagem: "numId duplicado: 3" });
  });

  it("arquivo que não é zip vira alerta de estrutura", () => {
    const { alertas } = varrerDocx(Buffer.from("não é docx"));
    expect(alertas[0].tipo).toBe("estrutura");
  });
});
