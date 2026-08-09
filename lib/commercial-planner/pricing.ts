export const PLANNER_FORMATS = ["digital", "preto-e-branco", "colorida"] as const;

export type PlannerFormat = (typeof PLANNER_FORMATS)[number];

const BASE_PRICE: Record<PlannerFormat, number> = {
  digital: 597,
  "preto-e-branco": 797,
  colorida: 957,
};

export interface PlannerPrice {
  formato: PlannerFormat;
  valorBase: number;
  valorAdicional: number;
  valorTotal: number;
  moeda: "BRL";
}

export function isPlannerFormat(value: unknown): value is PlannerFormat {
  return typeof value === "string" && PLANNER_FORMATS.includes(value as PlannerFormat);
}

export function calculatePlannerPrice(
  totalProcedimentos: number,
  formato: PlannerFormat
): PlannerPrice {
  if (!Number.isSafeInteger(totalProcedimentos) || totalProcedimentos < 0) {
    throw new TypeError("O total de procedimentos deve ser um inteiro não negativo.");
  }

  const valorBase = BASE_PRICE[formato];
  if (valorBase === undefined) throw new TypeError("Formato de entrega inválido.");

  const valorAdicional = Math.ceil(Math.max(totalProcedimentos - 100, 0) / 50) * 100;
  return {
    formato,
    valorBase,
    valorAdicional,
    valorTotal: valorBase + valorAdicional,
    moeda: "BRL",
  };
}
