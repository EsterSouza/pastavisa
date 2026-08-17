import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import {
  hashDocx,
  planejarSubstituicoes,
  resolveTextParts,
  type Substituicao,
} from "@/lib/docx-replacement-plan";
import { applyBatchChanges } from "@/lib/header-footer-replace";
import { validateDocxBuffer } from "@/lib/docx-validator";
import { DRAWING, montarDocx, paragrafo, run } from "./docx-fixture";

async function aplicar(buffer: Buffer, substituicoes: Substituicao[]) {
  const resultado = await applyBatchChanges(buffer, { substituicoes });
  const zip = new PizZip(resultado.buffer);
  return {
    ...resultado,
    texto: (parte: string) => zip.files[parte].asText(),
    zip,
  };
}

describe("motor de substituição em .docx", () => {
  it("substitui texto contido em um único run", async () => {
    const docx = montarDocx({ corpo: paragrafo(run("Clinica Antiga Ltda")) });

    const r = await aplicar(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);

    expect(r.texto("word/document.xml")).toContain("Clinica Nova Ltda");
    expect(r.aplicadas).toEqual(["Clinica Antiga"]);
    expect(r.naoEncontradas).toEqual([]);
  });

  it("substitui texto dividido entre vários runs sem colapsar os runs", async () => {
    const docx = montarDocx({
      corpo: paragrafo(run("Clin"), run("ica An"), run("tiga Ltda")),
    });

    const r = await aplicar(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);
    const xml = r.texto("word/document.xml");

    expect(xml.replace(/<[^>]+>/g, "")).toBe("Clinica Nova Ltda");
    // Os três runs continuam existindo: nada foi concentrado no primeiro.
    expect(xml.match(/<w:r>/g)).toHaveLength(3);
  });

  it("preserva a formatação dos runs que o par atravessa", async () => {
    const docx = montarDocx({
      corpo: paragrafo(run("Clinica ", "<w:rPr><w:b/></w:rPr>"), run("Antiga Ltda")),
    });

    const r = await aplicar(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);
    const xml = r.texto("word/document.xml");

    // O negrito do primeiro run sobrevive e o trecho não casado do segundo também.
    expect(xml).toContain("<w:b/>");
    expect(xml.match(/<w:r>/g)).toHaveLength(2);
    expect(xml.replace(/<[^>]+>/g, "")).toBe("Clinica Nova Ltda");
  });

  it("marca xml:space quando o texto restante tem espaço nas bordas", async () => {
    const docx = montarDocx({ corpo: paragrafo(run("Clinica "), run("Antiga Ltda")) });

    const r = await aplicar(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);

    expect(r.texto("word/document.xml")).toContain('xml:space="preserve"> Ltda<');
  });

  it("conta por escopo em cabeçalho, rodapé e corpo", async () => {
    const docx = montarDocx({
      corpo: paragrafo(run("CNPJ 111 no corpo")),
      header1: paragrafo(run("CNPJ 111 no cabecalho")),
      footer1: paragrafo(run("CNPJ 111 no rodape")),
    });

    const plano = planejarSubstituicoes(docx, [{ de: "CNPJ 111", para: "CNPJ 222" }]);

    expect(plano.totalOcorrencias).toBe(3);
    expect(plano.substituicoes[0]).toMatchObject({ total: 3, corpo: 1, cabecalho: 1, rodape: 1 });
  });

  it("substitui dentro de tabela e preserva a estrutura", async () => {
    const corpo =
      "<w:tbl><w:tr><w:tc><w:tcPr/>" +
      paragrafo(run("Clinica Antiga")) +
      "</w:tc></w:tr></w:tbl>";
    const docx = montarDocx({ corpo });

    const r = await aplicar(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);
    const xml = r.texto("word/document.xml");

    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("</w:tc>");
    expect(xml).toContain("Clinica Nova");
  });

  it("preserva acentos, cedilha e entidades sem escapar em dobro", async () => {
    const docx = montarDocx({ corpo: paragrafo(run("Clínica Coração &amp; Saúde")) });

    const r = await aplicar(docx, [{ de: "Clínica Coração", para: "Clínica Coração Nova" }]);
    const plano = planejarSubstituicoes(docx, [{ de: "Clínica Coração &", para: "x" }]);
    const xml = r.texto("word/document.xml");

    expect(xml).toContain("Clínica Coração Nova");
    expect(xml).toContain("&amp;");
    expect(xml).not.toContain("&amp;amp;");
    // O par é comparado contra o texto decodificado, não contra a entidade.
    expect(plano.substituicoes[0].total).toBe(1);
  });

  it("tolera variação de espaço sem aceitar regex livre", async () => {
    const docx = montarDocx({ corpo: paragrafo(run("CNPJ: 00.000.000/0001-00")) });

    const r = await aplicar(docx, [
      { de: "CNPJ :  00.000.000/0001-00", para: "CNPJ: 11.111.111/0001-11" },
    ]);
    const semRegex = planejarSubstituicoes(docx, [{ de: "CNPJ.*", para: "x" }]);

    expect(r.aplicadas).toHaveLength(1);
    expect(semRegex.substituicoes[0].total).toBe(0);
  });

  it("resolve sobreposição pela ordem dos pares, sem aplicar o concorrente", async () => {
    const docx = montarDocx({ corpo: paragrafo(run("ABCDE")) });

    const plano = planejarSubstituicoes(docx, [
      { de: "ABC", para: "X" },
      { de: "CDE", para: "Y" },
    ]);
    const r = await aplicar(docx, [
      { de: "ABC", para: "X" },
      { de: "CDE", para: "Y" },
    ]);

    expect(plano.substituicoes[0].total).toBe(1);
    expect(plano.substituicoes[1].total).toBe(0);
    expect(r.texto("word/document.xml").replace(/<[^>]+>/g, "")).toBe("XDE");
  });

  it("não encadeia: o resultado de um par não é reprocessado pelo seguinte", async () => {
    const docx = montarDocx({ corpo: paragrafo(run("alpha")) });

    const r = await aplicar(docx, [
      { de: "alpha", para: "beta" },
      { de: "beta", para: "gama" },
    ]);

    expect(r.texto("word/document.xml").replace(/<[^>]+>/g, "")).toBe("beta");
    expect(r.naoEncontradas).toEqual(["beta"]);
  });

  it("conta múltiplas ocorrências e reporta par sem ocorrência", async () => {
    const docx = montarDocx({
      corpo: paragrafo(run("eco"), run(" eco")) + paragrafo(run("eco")),
    });

    const plano = planejarSubstituicoes(docx, [
      { de: "eco", para: "novo" },
      { de: "inexistente", para: "x" },
    ]);

    expect(plano.substituicoes[0].total).toBe(3);
    expect(plano.naoEncontradas).toEqual(["inexistente"]);
  });

  it("entrega contexto legível com o trecho casado delimitado", () => {
    const docx = montarDocx({ corpo: paragrafo(run("Razao social: Clinica Antiga Ltda ME")) });

    const plano = planejarSubstituicoes(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);

    expect(plano.substituicoes[0].ocorrencias[0]).toMatchObject({
      escopo: "corpo",
      parte: "word/document.xml",
    });
    expect(plano.substituicoes[0].ocorrencias[0].contexto).toContain("«Clinica Antiga»");
  });

  it("preserva desenho e relação de imagem do cabeçalho", async () => {
    const docx = montarDocx({
      header1: paragrafo(run("Clinica Antiga")) + paragrafo(`<w:r>${DRAWING}</w:r>`),
    });

    const r = await aplicar(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);

    expect(r.texto("word/header1.xml")).toContain('r:embed="rId5"');
    expect(r.texto("word/_rels/header1.xml.rels")).toContain("media/image1.png");
    expect(r.zip.files["word/media/image1.png"]).toBeTruthy();
  });

  it("ignora cabeçalho órfão que nenhum sectPr referencia", async () => {
    const docx = montarDocx({
      header1: paragrafo(run("Clinica Antiga")),
      header2: paragrafo(run("Clinica Antiga")),
    });

    const zip = new PizZip(docx);
    const plano = planejarSubstituicoes(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);

    expect(resolveTextParts(zip)).not.toContain("word/header2.xml");
    expect(plano.substituicoes[0].total).toBe(1);
  });

  it("cai para todas as partes quando o grafo de sectPr não resolve", () => {
    const docx = montarDocx({ comSectPr: false, header1: paragrafo(run("Clinica Antiga")) });

    const plano = planejarSubstituicoes(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);

    expect(plano.substituicoes[0].cabecalho).toBe(1);
  });

  it("a contagem do plano é igual à do que foi aplicado", async () => {
    const docx = montarDocx({
      corpo: paragrafo(run("Clin"), run("ica Antiga")) + paragrafo(run("Clinica Antiga")),
      header1: paragrafo(run("Clinica Antiga")),
    });
    const subs = [{ de: "Clinica Antiga", para: "Clinica Nova" }];

    const plano = planejarSubstituicoes(docx, subs);
    const r = await aplicar(docx, subs);

    expect(plano.substituicoes[0].total).toBe(3);
    expect(r.contagens[0]).toMatchObject({ total: 3, corpo: 2, cabecalho: 1, rodape: 0 });
  });

  it("o plano não altera o documento de origem", () => {
    const docx = montarDocx({ corpo: paragrafo(run("Clinica Antiga")) });
    const antes = hashDocx(docx);

    planejarSubstituicoes(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);

    expect(hashDocx(docx)).toBe(antes);
  });

  it("o documento aplicado continua válido e abre como pacote íntegro", async () => {
    const docx = montarDocx({
      corpo: paragrafo(run("Clin"), run("ica An"), run("tiga Ltda")),
      header1: paragrafo(run("CNPJ 111")),
      footer1: paragrafo(run("CNPJ 111")),
    });

    const r = await aplicar(docx, [
      { de: "Clinica Antiga", para: "Clinica Nova" },
      { de: "CNPJ 111", para: "CNPJ 222" },
    ]);

    expect(validateDocxBuffer(r.buffer).issues).toEqual([]);
  });

  it("rejeita arquivo corrompido em vez de devolver plano vazio", () => {
    expect(() => planejarSubstituicoes(Buffer.from("isto nao e um docx"), [{ de: "a", para: "b" }])).toThrow();
  });

  it("hash muda quando o documento muda e permanece estável quando não muda", async () => {
    const docx = montarDocx({ corpo: paragrafo(run("Clinica Antiga")) });

    const r = await aplicar(docx, [{ de: "Clinica Antiga", para: "Clinica Nova" }]);

    expect(hashDocx(docx)).toBe(hashDocx(montarDocx({ corpo: paragrafo(run("Clinica Antiga")) })));
    expect(hashDocx(r.buffer)).not.toBe(hashDocx(docx));
  });

  it("ignora par cujo texto de origem é vazio ou só espaço", async () => {
    const docx = montarDocx({ corpo: paragrafo(run("Clinica Antiga")) });

    const r = await aplicar(docx, [
      { de: "   ", para: "x" },
      { de: "Clinica Antiga", para: "Clinica Nova" },
    ]);

    expect(r.aplicadas).toEqual(["Clinica Antiga"]);
    expect(r.contagens).toHaveLength(1);
  });
});
