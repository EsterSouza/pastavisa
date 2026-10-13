import { describe, expect, it } from "vitest";
import { calcularPrazos, ehDiaUtil, feriadosNacionais } from "@/lib/planejamento/prazos";

describe("prazos do planejamento", () => {
  it("bate com o exemplo conferido pela Ester", () => {
    expect(calcularPrazos("2026-09-11")).toEqual({
      dataPlanejamento: "2026-09-11",
      apreciacaoInicio: "2026-10-02",
      apreciacaoFim: "2026-10-07",
      entregaFinal: "2026-10-09",
    });
  });

  it("pula os feriados de outubro e novembro (planejamentos reais de 05/10 e 08/10/2026)", () => {
    expect(calcularPrazos("2026-10-05")).toMatchObject({
      apreciacaoInicio: "2026-10-27",
      apreciacaoFim: "2026-10-30",
      entregaFinal: "2026-11-04",
    });
    expect(calcularPrazos("2026-10-08")).toMatchObject({
      apreciacaoInicio: "2026-10-30",
      apreciacaoFim: "2026-11-05",
      entregaFinal: "2026-11-09",
    });
  });

  it("conta Sexta-feira da Paixão como feriado e carnaval como dia útil", () => {
    expect(feriadosNacionais(2027).has("2027-03-26")).toBe(true);
    expect(ehDiaUtil("2027-02-09")).toBe(true);
    expect(ehDiaUtil("2026-11-20")).toBe(false);
  });
});
