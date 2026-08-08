export type MentionKind =
  | "procedure"
  | "product"
  | "brand"
  | "active"
  | "indication"
  | "equipment"
  | "step"
  | "uncertain";

export type CoverageMode = "exact" | "personalizable" | "family" | "new";
export type DocumentRole =
  | "procedure"
  | "consent"
  | "record"
  | "general"
  | "sterilization"
  | "equipment";

export interface CommercialPlannerInput {
  cliente: string;
  municipio?: string;
  uf?: string;
  procedimentos: string;
  reutilizaMateriais?: boolean;
  possuiAutoclave?: boolean;
  equipamentos: string[];
}

export interface PlannerCatalogItem {
  id: string;
  name: string;
  type: string;
}

export interface AnalysisMention {
  name: string;
  canonicalName: string;
  evidence: string;
  kind: MentionKind;
  explicit: boolean;
}

export interface AnalysisCoverage {
  catalogId: string | null;
  documentName: string;
  documentType: string;
  role: DocumentRole;
  techniques: string[];
  mode: CoverageMode;
  equivalent: boolean;
  uncertain: boolean;
  alert?: string;
}

export interface PlannerAnalysis {
  mentions: AnalysisMention[];
  coverages: AnalysisCoverage[];
  alerts: string[];
}

export interface ExtractedTechnique {
  name: string;
  evidence: string[];
}

export interface ExtractionResult {
  techniques: ExtractedTechnique[];
  coverages: AnalysisCoverage[];
  alerts: string[];
}

export interface CoverageCandidate {
  key: string;
  catalogId: string | null;
  documentName: string;
  documentType: string;
  role: DocumentRole;
  techniques: string[];
  mode: CoverageMode;
  equivalent: boolean;
  uncertain: boolean;
}

export interface CoverageMap {
  techniques: ExtractedTechnique[];
  candidates: CoverageCandidate[];
  alerts: string[];
}

export type InternalPlannerDocument = CoverageCandidate;

export interface InternalCommercialPlan {
  techniques: ExtractedTechnique[];
  documents: InternalPlannerDocument[];
  alerts: string[];
  coverage: CoverageMap;
}

export interface PublicPlannerDocument {
  nome: string;
  tipo: string;
}

export interface PublicCommercialPlan {
  procedimentos: string[];
  documentos: PublicPlannerDocument[];
  alertas: string[];
  resumo: {
    totalProcedimentos: number;
    totalDocumentos: number;
    revisaoTecnicaObrigatoria: true;
  };
  aviso: "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.";
}

export type PlannerAnalyzer = (
  systemPrompt: string,
  userPrompt: string
) => Promise<{ data: unknown; tokensUsed: number }>;
