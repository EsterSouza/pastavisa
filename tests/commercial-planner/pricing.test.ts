import { describe, expect, it } from "vitest";
import { calculatePlannerPrice, PLANNER_FORMATS } from "@/lib/commercial-planner/pricing";

describe("commercial planner pricing", () => {
  it.each([
    [99, 0],
    [100, 0],
    [101, 100],
    [150, 100],
    [151, 200],
    [200, 200],
    [201, 300],
  ])("calcula o adicional para %i procedimentos", (procedures, additional) => {
    expect(calculatePlannerPrice(procedures, "digital")).toMatchObject({
      valorBase: 597,
      valorAdicional: additional,
      valorTotal: 597 + additional,
    });
  });

  it.each([
    ["digital", 597],
    ["preto-e-branco", 797],
    ["colorida", 957],
  ] as const)("usa o preco base do formato %s", (format, base) => {
    expect(calculatePlannerPrice(100, format)).toEqual({
      formato: format,
      valorBase: base,
      valorAdicional: 0,
      valorTotal: base,
      moeda: "BRL",
    });
  });

  it("mantem somente os tres formatos publicos", () => {
    expect(PLANNER_FORMATS).toEqual(["digital", "preto-e-branco", "colorida"]);
    expect(() => calculatePlannerPrice(-1, "digital")).toThrow(TypeError);
  });
});
