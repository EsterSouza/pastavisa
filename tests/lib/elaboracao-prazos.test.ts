import { describe, expect, it } from "vitest";
import { extrairPrazosElaboracao } from "@/lib/elaboracao-prazos";

// Trechos copiados dos modelos reais do "Documentos em Elaboração", um de cada época.
describe("extrairPrazosElaboracao", () => {
  it("lê o modelo atual (data do planejamento e cor de fundo)", () => {
    const texto = [
      "DOCUMENTOS EM ELABORAÇÃO",
      "Data deste planejamento: 08/10/2026",
      "Período de apreciação: 30/10/2026 a 05/11/2026",
      "Período para entrega final e gráfica: 09/11/2026",
      "Versão da Pasta: Digital",
      "Plataforma de entrega da Pasta Digital: Google Drive",
      "Cor de fundo da logomarca: #4a3428",
    ].join("\n");
    expect(extrairPrazosElaboracao(texto)).toEqual({
      inicioProjeto: "2026-10-08",
      apreciacaoInicio: "2026-10-30",
      apreciacaoFim: "2026-11-05",
      entregaFinal: "2026-11-09",
      versaoPasta: "Digital",
      logoBgHex: "4A3428",
    });
  });

  it("aceita datas sem ano e entrega em intervalo", () => {
    const texto = [
      "• Data de início do projeto: 15/07/2026",
      "• Período de apreciação dos documentos: 05/08 a 10/08",
      "• Data prevista para entrega final: 11/08",
      "• Cor de fundo predominante da identidade visual: bege rosado claro - HEX #EFE1D4",
    ].join("\n");
    const prazos = extrairPrazosElaboracao(texto);
    expect(prazos.apreciacaoInicio).toBe("2026-08-05");
    expect(prazos.apreciacaoFim).toBe("2026-08-10");
    expect(prazos.entregaFinal).toBe("2026-08-11");
    expect(prazos.logoBgHex).toBe("EFE1D4");
  });

  it("lê o modelo antigo, com os itens na mesma linha", () => {
    const texto =
      "• Data de Início do Projeto: 15/06/2026• Prazo estimado de entrega para apreciação: 06/07/2026 a 10/07/2026• Prazo para entrega final e gráfica: 14/07/2026";
    const prazos = extrairPrazosElaboracao(texto);
    expect(prazos.inicioProjeto).toBe("2026-06-15");
    expect(prazos.apreciacaoInicio).toBe("2026-07-06");
    expect(prazos.apreciacaoFim).toBe("2026-07-10");
    expect(prazos.entregaFinal).toBe("2026-07-14");
  });

  it("ignora o placeholder #hex e a cor vazia, e completa a virada do ano", () => {
    const texto = [
      "Data deste planejamento: 10/12/2026",
      "Prazo para apreciação: de 28/12 a 04/01",
      "Prazo para entrega e gráfica: até 08/01",
      "Cores predominantes da identidade visual informada: #hex",
      "Cor de fundo da logomarca:",
    ].join("\n");
    const prazos = extrairPrazosElaboracao(texto);
    expect(prazos.apreciacaoInicio).toBe("2026-12-28");
    expect(prazos.apreciacaoFim).toBe("2027-01-04");
    expect(prazos.entregaFinal).toBe("2027-01-08");
    expect(prazos.logoBgHex).toBeUndefined();
  });
});
