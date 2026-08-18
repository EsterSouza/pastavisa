import { buildBaselineDocuments } from "./baseline";
import type {
  CommercialPlannerInput,
  CoverageCandidate,
  CoverageMap,
  DocumentRole,
  InternalCommercialPlan,
} from "./types";

const modePriority = { exact: 0, personalizable: 1, family: 2, new: 3 } as const;
const roleOrder: DocumentRole[] = ["general", "record", "procedure", "consent", "equipment", "sterilization"];

function selectMinimumCoverage(candidates: CoverageCandidate[], techniqueNames: string[]) {
  const uncovered = new Set(techniqueNames);
  const selected: CoverageCandidate[] = [];

  while (uncovered.size > 0) {
    const best = candidates
      .map((candidate) => ({
        candidate,
        gain: candidate.techniques.filter((technique) => uncovered.has(technique)).length,
      }))
      .filter(({ gain }) => gain > 0)
      .sort(
        (a, b) =>
          b.gain - a.gain ||
          modePriority[a.candidate.mode] - modePriority[b.candidate.mode] ||
          a.candidate.documentName.localeCompare(b.candidate.documentName, "pt-BR")
      )[0];
    if (!best) break;
    selected.push(best.candidate);
    best.candidate.techniques.forEach((technique) => uncovered.delete(technique));
  }

  return selected;
}

export function buildMinimumPlan(
  input: CommercialPlannerInput,
  coverage: CoverageMap
): InternalCommercialPlan {
  const alerts = [...coverage.alerts];
  // A base obrigatória entra antes do corte: os documentos de esterilização e de
  // equipamento dela passam pela mesma conferência de autoclave e de equipamento
  // declarado que vale para o resto.
  const baseline = buildBaselineDocuments(input, coverage.techniques.map((technique) => technique.name));
  const allowed = [...baseline, ...coverage.candidates].filter((candidate) => {
    const normalizedName = candidate.documentName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const isSterilization =
      candidate.role === "sterilization" ||
      /esteriliz|autoclave|processamento.*reutiliz/.test(normalizedName);
    const isEquipment =
      candidate.role === "equipment" ||
      /gestao.*equipament|manutencao.*equipament|equipamentos eletromedicos/.test(normalizedName);
    if (isSterilization) {
      return input.reutilizaMateriais === true && input.possuiAutoclave === true;
    }
    if (isEquipment) return input.equipamentos.length > 0;
    return true;
  });

  if (input.reutilizaMateriais === true && input.possuiAutoclave !== true) {
    alerts.push("Confirme a existência de autoclave e o processamento realizado antes de incluir controles de esterilização.");
  }

  const techniqueNames = coverage.techniques.map((technique) => technique.name);
  const selected = [
    ...selectMinimumCoverage(allowed.filter((candidate) => candidate.role === "procedure"), techniqueNames),
    ...selectMinimumCoverage(allowed.filter((candidate) => candidate.role === "consent"), techniqueNames),
    ...allowed.filter((candidate) => !["procedure", "consent"].includes(candidate.role)),
  ];
  const unique = new Map(selected.map((candidate) => [candidate.key, candidate]));
  const documents = Array.from(unique.values()).sort(
    (a, b) =>
      roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) ||
      a.documentName.localeCompare(b.documentName, "pt-BR")
  );

  return {
    techniques: coverage.techniques,
    documents,
    alerts: Array.from(new Set(alerts)),
    coverage,
  };
}
