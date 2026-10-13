import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { LEGISLATION_LIBRARY } from "@visa/legislacao";
import { gerarDocxPlanejamento } from "@/lib/planejamento/docx";
import { aplicarRegras, SECAO_ASSISTENCIAL, SECAO_INSTITUCIONAL, SECAO_ROTINAS } from "@/lib/planejamento/regras";
import { dataAcesso, referenciaDoBanco } from "@/lib/planejamento/referencias";
import type { Planejamento } from "@/lib/planejamento/tipos";

describe("regras fixas do planejamento", () => {
  it("tira o que nunca entra e garante PSP e POP de intercorrências em serviço de saúde", () => {
    const { secoes, removidos } = aplicarRegras(
      [
        { titulo: "POPs - PROCEDIMENTOS ESTÉTICOS INJETÁVEIS", itens: ["POP - Toxina Botulínica"] },
        { titulo: SECAO_INSTITUCIONAL, itens: ["Manual de Boas Práticas em Serviço de Saúde", "PGRSS"] },
        {
          titulo: SECAO_ROTINAS,
          itens: [
            "POP - Higienização das Mãos",
            "POP — Uso de Materiais Descartáveis e Controle de Materiais de Uso Único",
            "POP - Higienização das Mãos",
          ],
        },
        { titulo: SECAO_ASSISTENCIAL, itens: ["POP - Encaminhamento Profissional e Condutas de Segurança Assistencial"] },
      ],
      true
    );
    expect(removidos).toHaveLength(2);
    expect(secoes.map((s) => s.titulo)).toEqual([
      SECAO_INSTITUCIONAL,
      SECAO_ROTINAS,
      SECAO_ASSISTENCIAL,
      "POPs - PROCEDIMENTOS ESTÉTICOS INJETÁVEIS",
    ]);
    expect(secoes[0].itens).toContain("Plano de Segurança do Paciente");
    expect(secoes[1].itens).toEqual(["POP - Higienização das Mãos"]);
    expect(secoes[2].itens).toEqual(["POP - Intercorrências Assistenciais e Encaminhamento de Urgência"]);
  });

  it("não acrescenta PSP fora de serviço de saúde", () => {
    const { secoes } = aplicarRegras([{ titulo: SECAO_INSTITUCIONAL, itens: ["PGRSS"] }], false);
    expect(secoes[0].itens).toEqual(["PGRSS"]);
  });
});

describe("DOCX do planejamento", () => {
  const rdc63 = LEGISLATION_LIBRARY.find((e) => e.name === "RDC Anvisa nº 63/2011")!;

  it("referência do banco sai sem o 'Disponível em' no texto e com o destaque", () => {
    const ref = referenciaDoBanco(rdc63);
    expect(ref.texto).not.toMatch(/Dispon[ií]vel em/);
    expect(ref.url).toMatch(/^https:\/\//);
    expect(dataAcesso("2026-10-13")).toBe("13 out. 2026");
  });

  it("gera um pacote válido com negrito no destaque e Acesso em", async () => {
    const plano: Planejamento = {
      nomeCliente: "Clínica Exemplo",
      cidadeUf: "Niterói/RJ",
      introducao: "Texto de introdução.",
      cronograma: [{ rotulo: "Data deste planejamento", valor: "13/10/2026" }],
      identificacao: [{ rotulo: "CNPJ", valor: "" }],
      estruturaFisica: ["Sala única com pia."],
      terceirizados: [{ rotulo: "Coleta de resíduos", valor: "Empresa X & Filhos" }],
      procedimentos: ["Microagulhamento"],
      secoes: [{ titulo: SECAO_INSTITUCIONAL, itens: ["PGRSS"] }],
      avisoPrazo: true,
      equipamentos: [{ id: "E01", nome: "Caneta", marca: "M", serie: "", registroAnvisa: "" }],
      insumos: [],
      matriz: [{ id: "P01", procedimento: "Microagulhamento", equipamentos: "E01" }],
      referencias: [
        { titulo: "NORMAS SANITÁRIAS DA ANVISA E GESTÃO DE RESÍDUOS", itens: [referenciaDoBanco(rdc63)] },
        { titulo: "MANUAIS", itens: [{ texto: "SILVA, A. et al. Manual. In: Livro. Rio de Janeiro: X, 2020." }] },
      ],
      acessoEm: "2026-10-13",
      cnaes: [],
    };
    const zip = new PizZip(await gerarDocxPlanejamento(plano));
    const doc = zip.file("word/document.xml")!.asText();
    expect(doc).toContain("Acesso em: 13 out. 2026.");
    expect(doc).toContain("Empresa X &amp; Filhos");
    const destaque = (rdc63 as { destaque?: string }).destaque;
    if (destaque) expect(doc).toMatch(new RegExp(`<w:b/>[^]*?${destaque.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    expect(doc).toMatch(/<w:i\/>[^<]*<w:sz w:val="22"\/><w:lang w:val="pt-BR"\/><\/w:rPr><w:t xml:space="preserve">et al\.<\/w:t>/);
    expect(zip.file("word/_rels/document.xml.rels")!.asText()).toContain('TargetMode="External"');
    expect(zip.file("word/footer1.xml")?.asText() ?? "").not.toContain("{{RODAPE}}");
  });
});
