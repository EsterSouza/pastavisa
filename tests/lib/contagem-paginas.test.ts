import { describe, expect, it } from "vitest";
import { custoDaPasta, lerDocumentos, pastaImpressa, planilhaCsv, tipoDoDocumento } from "@/lib/contagem-paginas";

describe("contagem de páginas", () => {
  it("classifica os PDFs reais da Pasta Personalizada", () => {
    expect(tipoDoDocumento("TCLE — TOXINA BOTULÍNICA")).toBe("TCLE");
    expect(tipoDoDocumento("POP — HIGIENIZAÇÃO DAS MÃOS")).toBe("POP");
    expect(tipoDoDocumento("MANUAL DE BOAS PRÁTICAS EM SERVIÇO DE SAÚDE")).toBe("MBP");
    expect(tipoDoDocumento("PLANO DE GERENCIAMENTO DE RESÍDUOS DE SERVIÇOS DE SAÚDE (PGRSS)")).toBe("PGRSS");
    expect(tipoDoDocumento("PLANO DE SEGURANÇA DO PACIENTE")).toBe("PSP");
    expect(tipoDoDocumento("PLANO DE CONTINGÊNCIA E EMERGÊNCIAS")).toBe("Outros planos");
    expect(tipoDoDocumento("PLANILHA DE CONTROLE DE TEMPERATURA E UMIDADE")).toBe("Planilha");
    expect(tipoDoDocumento("FICHA DE ANAMNESE ESTÉTICA INTEGRATIVA")).toBe("Ficha");
  });

  it("separa pasta impressa de digital pela versão do planejamento", () => {
    expect(pastaImpressa("Digital + Colorida")).toBe(true);
    expect(pastaImpressa("Digital + Preto e Branco")).toBe(true);
    expect(pastaImpressa("Digital")).toBe(false);
    expect(pastaImpressa(null)).toBe(false);
  });

  it("só aceita lista com nome e páginas válidos", () => {
    expect(lerDocumentos([{ nome: " POP ", paginas: 5 }])).toEqual([{ nome: "POP", paginas: 5 }]);
    expect(lerDocumentos([])).toBeNull();
    expect(lerDocumentos([{ nome: "POP", paginas: 0 }])).toBeNull();
    expect(lerDocumentos([{ nome: "POP", paginas: 2.5 }])).toBeNull();
    expect(lerDocumentos([{ nome: "", paginas: 3 }])).toBeNull();
    expect(lerDocumentos("x")).toBeNull();
  });

  it("rateia Kevin por todas as pastas do mês e a impressora só pelas impressas", () => {
    // Mês de outubro da conta da Ester: 3 digitais, 3 preto e branco e 3 coloridas.
    const mes = [
      ...Array(3).fill({ versao: "Digital" }),
      ...Array(3).fill({ versao: "Digital + Preto e Branco" }),
      ...Array(3).fill({ versao: "Digital + Colorida" }),
    ];
    const colorida = custoDaPasta({ versao: "Digital + Colorida", paginas: 311 }, mes);
    expect(colorida.preco).toBe(957);
    expect(colorida.custo).toBeCloseTo(231.64, 2);
    const digital = custoDaPasta({ versao: "Digital", paginas: 311 }, mes);
    expect(digital.custo).toBeCloseTo(101.76, 2);
    expect(digital.itens.map(([rotulo]) => rotulo)).not.toContain("Papel");
  });

  it("monta a planilha no formato do Excel em português", () => {
    const csv = planilhaCsv([
      ["Cliente", "Custo"],
      ['Clínica "Bela"; Estética', 101.756],
      ["=SOMA(A1)", 597],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split("\r\n")).toEqual(["Cliente;Custo", '"Clínica ""Bela""; Estética";101,76', "'=SOMA(A1);597"]);
  });
});
