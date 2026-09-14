import { describe, expect, it } from "vitest";

import {
  extrairDocumentosDoTextoElaboracao,
  mesclarDocumentosExtraidos,
} from "@/lib/document-list-extractor";
import { detectarReferenciasNaoCadastradas, extractReferenceLines } from "@/lib/reference-extractor";
import { criarChaveReferencia } from "@/lib/reference-deduplication";

// Texto no formato que o mammoth devolve para o modelo atual do "Documentos em
// Elaboração": uma linha por parágrafo ou célula, com linhas em branco no meio.
const ELABORACAO = `DOCUMENTOS EM ELABORAÇÃO

RELAÇÃO GERAL DE PROCEDIMENTOS INFORMADOS

1. Consulta de Enfermagem

2. Controle da Glicemia

I. DOCUMENTOS INSTITUCIONAIS, GERENCIAIS E DE SEGURANÇA

1. Relação de Serviços, Equipamentos e Insumos Oferecidos

2. Manual de Boas Práticas em Serviço de Saúde

3. POP — Controle da Glicemia

FICHA DE AVALIAÇÃO

1. Ficha de Anamnese Estética Integrativa

VII. TERMOS DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)

1. TCLE — Curativo e Cuidados com Feridas

TABELA 2 — PROCEDIMENTOS × EQUIPAMENTOS × INSUMOS

Nº

Procedimento

Equipamentos

01

Controle da Glicemia

RELAÇÃO DE EQUIPAMENTO INFORMADO

Procedimento vinculado

LEGISLAÇÃO E FONTES OFICIAIS APLICÁVEIS

Âmbito federal

1. BRASIL. Lei nº 7.498, de 25 de junho de 1986. Regulamenta o exercício da Enfermagem.

https://www.planalto.gov.br/ccivil_03/leis/l7498.htm

2. NORMAS E ORIENTAÇÕES DA ANVISA E DO MINISTÉRIO DA SAÚDE

1. ANVISA. Resolução RDC nº 222, de 28 de março de 2018. Boas práticas de gerenciamento dos resíduos de serviços de saúde. Disponível em: https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2018/rdc0222_28_03_2018.pdf

PARÁ. Decreto nº 3.614, de 22 de dezembro de 2023. Altera o Decreto Estadual nº 3.948/1985. Belém, PA, 2023.

PARAUAPEBAS. Lei Complementar nº 008, de 2016. Dispõe sobre o Código Sanitário do Município de Parauapebas.

4. LEGISLAÇÃO AMBIENTAL E DE RESÍDUOS — RIO GRANDE DO SUL

1. CONAMA. Resolução nº 358, de 29 de abril de 2005. Tratamento e disposição final dos resíduos dos serviços de saúde.

6. INFRAESTRUTURA FÍSICA E INSTALAÇÕES

A Lei nº 1.234 citada no memorial não faz parte da lista.`;

describe("lista de documentos lida do docx", () => {
  const nomes = extrairDocumentosDoTextoElaboracao(ELABORACAO).map((d) => d.nome);

  it("traz os documentos listados", () => {
    expect(nomes).toEqual([
      "Relação de Serviços, Equipamentos e Insumos Oferecidos",
      "Manual de Boas Práticas em Serviço de Saúde",
      "POP — Controle da Glicemia",
      "Ficha de Anamnese Estética Integrativa",
      "TCLE — Curativo e Cuidados com Feridas",
    ]);
  });

  it("não transforma título de seção, procedimento ou cabeçalho de tabela em documento", () => {
    // Regressão: toda pasta desde agosto ganhava "Procedimento" e a lista de
    // procedimentos virava documento, porque o fallback lia o docx inteiro.
    expect(nomes).not.toContain("RELAÇÃO GERAL DE PROCEDIMENTOS INFORMADOS");
    expect(nomes).not.toContain("Procedimento");
    expect(nomes).not.toContain("Procedimento vinculado");
    expect(nomes).not.toContain("Controle da Glicemia");
    expect(nomes).not.toContain("FICHA DE AVALIAÇÃO");
    expect(nomes).not.toContain("RELAÇÃO DE EQUIPAMENTO INFORMADO");
  });

  it("descarta nome genérico mesmo quando vem da IA", () => {
    const docs = mesclarDocumentosExtraidos(
      [
        { nome: "Procedimentos", tipo: "OUTROS" },
        { nome: "RELAÇÃO GERAL DE PROCEDIMENTOS INFORMADOS", tipo: "OUTROS" },
        { nome: "POP — Controle da Glicemia", tipo: "POP" },
      ],
      []
    );
    expect(docs.map((d) => d.nome)).toEqual(["POP — Controle da Glicemia"]);
  });

  it("aceita item numerado sem ponto depois do número", () => {
    const docs = extrairDocumentosDoTextoElaboracao("4. POP — Microagulhamento\n\n5 POP – Massagem redutora");
    expect(docs.map((d) => d.nome)).toEqual(["POP — Microagulhamento", "POP – Massagem redutora"]);
  });
});

describe("referências lidas do docx", () => {
  const referencias = extractReferenceLines(ELABORACAO);

  it("separa cada ato, inclusive estadual e municipal sem BRASIL na autoria", () => {
    // Regressão: PARÁ e PARAUAPEBAS eram coladas na RDC 222 e nunca apareciam
    // como referência nova.
    expect(referencias.map((r) => r.slice(0, 30))).toEqual([
      "BRASIL. Lei nº 7.498, de 25 de",
      "ANVISA. Resolução RDC nº 222, ",
      "PARÁ. Decreto nº 3.614, de 22 ",
      "PARAUAPEBAS. Lei Complementar ",
      "CONAMA. Resolução nº 358, de 2",
    ]);
  });

  it("junta a URL da linha de baixo à referência", () => {
    expect(referencias[0]).toContain("https://www.planalto.gov.br/ccivil_03/leis/l7498.htm");
  });

  it("não lê ato citado fora da seção de legislação nem título de subseção", () => {
    expect(referencias.join("\n")).not.toContain("1.234");
    expect(referencias.join("\n")).not.toContain("NORMAS E ORIENTAÇÕES");
  });

  it("aponta como nova a referência que a base não tem, e só ela", () => {
    const base = [
      {
        id: "lei-7498",
        estadoUf: "BR",
        titulo: "Lei nº 7.498/1986 — Exercício da Enfermagem",
        referenciaAbnt: "BRASIL. Lei nº 7.498, de 25 de junho de 1986. Dispõe sobre a regulamentação do exercício da enfermagem.",
      },
      {
        id: "decreto-94406",
        estadoUf: "BR",
        titulo: "Decreto nº 94.406/1987 — Regulamenta Lei de Enfermagem",
        referenciaAbnt: "BRASIL. Decreto nº 94.406, de 8 de junho de 1987. Regulamenta a Lei nº 7.498/1986.",
      },
    ];
    const novas = detectarReferenciasNaoCadastradas(ELABORACAO, base, { estadoUf: "PA" }).map((r) =>
      r.titulo.slice(0, 20)
    );
    expect(novas).toEqual([
      "ANVISA. Resolução RD",
      "PARÁ. Decreto nº 3.6",
      "PARAUAPEBAS. Lei Com",
      "CONAMA. Resolução nº",
    ]);
  });
});

describe("chave do ato normativo", () => {
  it("reconhece tipo, número e ano", () => {
    // Regressão: o \\b dos padrões tinha virado o caractere de controle
    // backspace, e todo ato caía na chave de texto livre.
    expect(criarChaveReferencia({ titulo: "Lei nº 7.498/1986" })).toBe("br:|lei|7498|1986");
    expect(criarChaveReferencia({ titulo: "RDC nº 50/2002 — Projetos físicos" })).toBe("br:|rdc|50|2002");
    expect(
      criarChaveReferencia({ titulo: "BRASIL. ANVISA. Resolução RDC nº 36, de 25 de julho de 2013." })
    ).toBe("br:|rdc|36|2013");
  });
});
