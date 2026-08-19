import "server-only";
import { loadActivePlannerCatalog } from "./catalog.server";
import { buildCoverageMap } from "./coverage";
import { extractExplicitTechniques } from "./extraction";
import { toPublicPlannerOutput } from "./output";
import { buildMinimumPlan } from "./plan";
import type { PlannerAnalyzer, PlannerCatalogItem, PublicCommercialPlan } from "./types";
import { validatePlannerInput } from "./validation";

interface PlannerDependencies {
  analyzer?: PlannerAnalyzer;
  catalog?: PlannerCatalogItem[];
}

export async function createCommercialPlan(
  rawInput: unknown,
  dependencies: PlannerDependencies = {}
): Promise<PublicCommercialPlan> {
  const input = validatePlannerInput(rawInput);
  const catalog = dependencies.catalog ? [...dependencies.catalog] : await loadActivePlannerCatalog();
  const extraction = await extractExplicitTechniques(input, catalog, dependencies.analyzer);
  const coverage = buildCoverageMap(extraction, catalog);
  return toPublicPlannerOutput(buildMinimumPlan(input, coverage), input.procedimentos);
}
