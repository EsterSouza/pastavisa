import { normalizeTechnique } from "./extraction";
import type {
  CoverageCandidate,
  CoverageMap,
  DocumentRole,
  ExtractionResult,
  PlannerCatalogItem,
} from "./types";

function candidateKey(catalogId: string | null, role: DocumentRole, name: string): string {
  return catalogId || `${role}:${normalizeTechnique(name)}`;
}

function provisionalCandidate(technique: string, role: "procedure" | "consent"): CoverageCandidate {
  const prefix = role === "procedure" ? "POP" : "TCLE";
  const documentName = `${prefix} — ${technique}`;
  return {
    key: candidateKey(null, role, documentName),
    catalogId: null,
    documentName,
    documentType: prefix,
    role,
    techniques: [technique],
    mode: "new",
    equivalent: false,
    uncertain: false,
  };
}

/**
 * Consulta, avaliação e anamnese não geram termo de consentimento próprio: o
 * consentimento cobre o procedimento executado, não o atendimento que o antecede.
 */
function consentApplies(technique: string): boolean {
  return !/^(consulta|avalia|anamnese|retorno|acompanhamento)/.test(normalizeTechnique(technique));
}

export function buildCoverageMap(
  extraction: ExtractionResult,
  catalog: PlannerCatalogItem[]
): CoverageMap {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const techniqueByKey = new Map(extraction.techniques.map((item) => [normalizeTechnique(item.name), item.name]));
  const candidates = new Map<string, CoverageCandidate>();
  const alerts = [...extraction.alerts];

  for (const proposal of extraction.coverages) {
    const techniques = Array.from(
      new Set(
        proposal.techniques
          .map((name) => techniqueByKey.get(normalizeTechnique(name)))
          .filter((name): name is string => Boolean(name))
      )
    );
    const catalogItem = proposal.catalogId ? catalogById.get(proposal.catalogId) : undefined;

    if (proposal.uncertain) {
      alerts.push(proposal.alert || "Uma cobertura documental precisa de confirmação técnica.");
      continue;
    }
    if (proposal.mode !== "new" && !catalogItem) {
      continue;
    }
    if (
      ["procedure", "consent"].includes(proposal.role) &&
      techniques.length > 1 &&
      !proposal.equivalent
    ) {
      continue;
    }
    if (["procedure", "consent"].includes(proposal.role) && techniques.length === 0) continue;
    if (proposal.mode === "new") continue;

    const documentName = catalogItem!.name;
    const documentType = catalogItem!.type;
    const key = candidateKey(catalogItem!.id, proposal.role, documentName);
    const existing = candidates.get(key);
    if (existing) {
      existing.techniques = Array.from(new Set([...existing.techniques, ...techniques]));
    } else {
      candidates.set(key, {
        key,
        catalogId: catalogItem!.id,
        documentName,
        documentType,
        role: proposal.role,
        techniques,
        mode: proposal.mode,
        equivalent: proposal.equivalent,
        uncertain: false,
      });
    }
  }

  for (const technique of extraction.techniques) {
    for (const role of ["procedure", "consent"] as const) {
      const covered = Array.from(candidates.values()).some(
        (candidate) => candidate.role === role && candidate.techniques.includes(technique.name)
      );
      if (role === "consent" && !consentApplies(technique.name)) continue;
      if (!covered) {
        const provisional = provisionalCandidate(technique.name, role);
        candidates.set(provisional.key, provisional);
      }
    }
  }

  return {
    techniques: extraction.techniques,
    candidates: Array.from(candidates.values()),
    alerts: Array.from(new Set(alerts)),
  };
}
