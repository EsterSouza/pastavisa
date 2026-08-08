import type {
  AnalysisCoverage,
  AnalysisMention,
  CommercialPlannerInput,
  CoverageMode,
  DocumentRole,
  MentionKind,
  PlannerAnalysis,
} from "./types";

const mentionKinds = new Set<MentionKind>([
  "procedure",
  "product",
  "brand",
  "active",
  "indication",
  "equipment",
  "step",
  "uncertain",
]);
const coverageModes = new Set<CoverageMode>(["exact", "personalizable", "family", "new"]);
const documentRoles = new Set<DocumentRole>([
  "procedure",
  "consent",
  "record",
  "general",
  "sterilization",
  "equipment",
]);

export class PlannerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerValidationError";
  }
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validatePlannerInput(value: unknown): CommercialPlannerInput {
  if (!value || typeof value !== "object") throw new PlannerValidationError("Dados do planejamento ausentes.");
  const raw = value as Record<string, unknown>;
  const cliente = text(raw.cliente, 160);
  const procedimentos = text(raw.procedimentos, 8_000);
  if (!cliente) throw new PlannerValidationError("Informe o nome do cliente.");
  if (!procedimentos) throw new PlannerValidationError("Informe os procedimentos declarados.");

  const equipamentos = Array.isArray(raw.equipamentos)
    ? raw.equipamentos.map((item) => text(item, 160)).filter(Boolean).slice(0, 50)
    : [];

  return {
    cliente,
    municipio: text(raw.municipio, 120) || undefined,
    uf: text(raw.uf, 2).toUpperCase() || undefined,
    procedimentos,
    reutilizaMateriais: typeof raw.reutilizaMateriais === "boolean" ? raw.reutilizaMateriais : undefined,
    possuiAutoclave: typeof raw.possuiAutoclave === "boolean" ? raw.possuiAutoclave : undefined,
    equipamentos,
  };
}

function parseMention(value: unknown): AnalysisMention | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const kind = raw.kind as MentionKind;
  const mention: AnalysisMention = {
    name: text(raw.name, 200),
    canonicalName: text(raw.canonicalName, 200),
    evidence: text(raw.evidence, 300),
    kind,
    explicit: raw.explicit === true,
  };
  return mention.name && mention.canonicalName && mention.evidence && mentionKinds.has(kind) ? mention : null;
}

function parseCoverage(value: unknown): AnalysisCoverage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const role = raw.role as DocumentRole;
  const mode = raw.mode as CoverageMode;
  const techniques = Array.isArray(raw.techniques)
    ? raw.techniques.map((item) => text(item, 200)).filter(Boolean).slice(0, 50)
    : [];
  if (!documentRoles.has(role) || !coverageModes.has(mode)) return null;

  return {
    catalogId: text(raw.catalogId, 200) || null,
    documentName: text(raw.documentName, 240),
    documentType: text(raw.documentType, 40),
    role,
    techniques,
    mode,
    equivalent: raw.equivalent === true,
    uncertain: raw.uncertain === true,
    alert: text(raw.alert, 400) || undefined,
  };
}

export function validatePlannerAnalysis(value: unknown): PlannerAnalysis {
  if (!value || typeof value !== "object") throw new PlannerValidationError("A análise sanitária retornou dados inválidos.");
  const raw = value as Record<string, unknown>;
  return {
    mentions: (Array.isArray(raw.mentions) ? raw.mentions : [])
      .map(parseMention)
      .filter((item): item is AnalysisMention => item !== null)
      .slice(0, 100),
    coverages: (Array.isArray(raw.coverages) ? raw.coverages : [])
      .map(parseCoverage)
      .filter((item): item is AnalysisCoverage => item !== null)
      .slice(0, 500),
    alerts: (Array.isArray(raw.alerts) ? raw.alerts : [])
      .map((item) => text(item, 400))
      .filter(Boolean)
      .slice(0, 50),
  };
}
