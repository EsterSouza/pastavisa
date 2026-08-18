import { describe, expect, it } from "vitest";

import legislacoes from "@/seed/legislacoes";
import { criarChaveReferencia } from "@/lib/reference-deduplication";
import { associarLegislacoesDoDocumento } from "@/lib/legislation-matcher";

describe("base unificada projetada no formato da tabela", () => {
  it("nenhuma norma colide na chave de referência", () => {
    // A tabela tem índice único em chaveReferencia: duas normas na mesma chave
    // fazem o seed derrubar uma sobre a outra e a pasta perde a citação.
    const porChave = new Map<string, string[]>();
    for (const leg of legislacoes) {
      const chave = criarChaveReferencia(leg);
      porChave.set(chave, [...(porChave.get(chave) || []), leg.titulo]);
    }

    const colisoes = [...porChave.entries()]
      .filter(([, titulos]) => titulos.length > 1)
      .map(([chave, titulos]) => `${chave}: ${titulos.join(" | ")}`);

    expect(colisoes).toEqual([]);
  });

  it("a chave sai do ato do título, não da norma citada na ementa", () => {
    // Regressão: a ementa do Decreto 45.585 começa com "Regulamenta a Lei
    // Complementar nº 197/2018", e a chave saía como se o decreto fosse a lei.
    const decreto = criarChaveReferencia({
      estadoUf: "RJ",
      municipio: "Rio de Janeiro",
      titulo: "Decreto Rio nº 45.585/2018",
      referenciaAbnt:
        "RIO DE JANEIRO (Município). Decreto nº 45.585, de 26 de setembro de 2018. Regulamenta a Lei Complementar nº 197/2018, que institui o Código Sanitário do Município do Rio de Janeiro.",
    });
    const lei = criarChaveReferencia({
      estadoUf: "RJ",
      municipio: "Rio de Janeiro",
      titulo: "Lei Complementar RJ nº 197/2018",
      referenciaAbnt:
        "RIO DE JANEIRO (Município). Lei Complementar nº 197, de 26 de setembro de 2018. Institui o Código Sanitário do Município do Rio de Janeiro.",
    });

    expect(decreto).toContain("decreto");
    expect(decreto).not.toBe(lei);
  });

  it("toda norma tem referência ABNT preenchida", () => {
    const semRef = legislacoes.filter((l) => !l.referenciaAbnt?.trim()).map((l) => l.titulo);
    expect(semRef).toEqual([]);
  });

  it("norma municipal declara UF junto com o município", () => {
    const soltas = legislacoes.filter((l) => l.municipio && l.estadoUf === "BR").map((l) => l.titulo);
    expect(soltas).toEqual([]);
  });
});

describe("alcance territorial ao associar normas a um documento", () => {
  const doDocumento = (texto: string, escopo: { estadoUf?: string; municipio?: string }) =>
    associarLegislacoesDoDocumento(
      texto,
      legislacoes.map((leg, i) => ({ ...leg, id: `leg-${i}` })),
      escopo,
    ).map((l) => l.titulo);

  // O extrator lê a lista de referências de um documento, então o texto tem de
  // vir na forma em que aparece lá — entrada de autoria à frente.
  const REFERENCIA_PR =
    "PARANÁ. Assembleia Legislativa. Lei nº 13.331, de 23 de novembro de 2001. Dispõe sobre a organização, regulamentação, fiscalização e controle das ações dos serviços de saúde no Estado do Paraná.";
  const REFERENCIA_RIO =
    "RIO DE JANEIRO (Município). Decreto Municipal nº 23.915, de 13 de janeiro de 2004. Dispõe sobre o licenciamento sanitário a que estão sujeitos os salões de cabeleireiros, os institutos de beleza, estética, podologia e estabelecimentos congêneres.";

  it("associa a estadual do Paraná a um documento de cliente do PR", () => {
    expect(doDocumento(REFERENCIA_PR, { estadoUf: "PR" })).toContain(
      "Lei Estadual PR nº 13.331/2001",
    );
  });

  it("não associa a estadual do Paraná a um cliente de Santa Catarina", () => {
    expect(doDocumento(REFERENCIA_PR, { estadoUf: "SC" })).not.toContain(
      "Lei Estadual PR nº 13.331/2001",
    );
  });

  it("norma municipal não vaza para outra cidade da mesma UF", () => {
    // Era o furo que o campo municipio veio fechar: sem ele, um decreto da
    // capital entrava na pasta de um cliente de Niterói.
    expect(doDocumento(REFERENCIA_RIO, { estadoUf: "RJ", municipio: "Rio de Janeiro" })).toContain(
      "Decreto Rio nº 23.915/2004",
    );
    expect(
      doDocumento(REFERENCIA_RIO, { estadoUf: "RJ", municipio: "Niterói" }),
    ).not.toContain("Decreto Rio nº 23.915/2004");
  });
});
