import type { Tone } from "@/components/ui/Status";

export interface Template {
  id: string;
  nome: string;
  tipo: string;
  padraoHeader: string;
  processingType: string;
  ativo: boolean;
  criadoEm: string;
}

export interface TemplateValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
}

export interface TemplateValidationReport {
  variaveis: string[];
  variaveisReconhecidas: string[];
  variaveisDesconhecidas: string[];
  condicionais: Array<{ key: string; valid: boolean }>;
  blocosIa: number;
  issues: TemplateValidationIssue[];
  valid: boolean;
}

export interface TemplateVersion {
  id: string;
  nome: string;
  tipo: string;
  padraoHeader: string;
  processingType: string;
  arquivoPath: string;
  motivo: string | null;
  criadaEm: string;
}

export interface BulkImportResult {
  nome: string;
  status: string;
  tipo?: string;
  variaveis?: number;
  errosValidacao?: number;
  error?: string;
}

export const TIPOS = ["MBP", "POP", "TCLE", "PGRSS", "FICHA", "PLANILHA", "GUIA", "TERMO", "RECEITUARIO", "OUTROS"];
export const PADROES = ["A", "B", "C", "D"];
export const PADROES_LABEL: Record<string, string> = {
  A: "Institucional",
  B: "POP",
  C: "TCLE/Ficha",
  D: "Consultora",
};

// `tone` usa apenas as cinco cores de components/ui/Status.tsx: as classes
// roxo/índigo do painel antigo não existem em tailwind.config e saíam sem cor.
export const PROCESSING_TYPES: Array<{ value: string; label: string; tone: Tone }> = [
  { value: "HEADER_ONLY", label: "Sem IA ($0)", tone: "neutro" },
  { value: "LIGHT_HAIKU", label: "IA leve (~$0,01)", tone: "info" },
  { value: "HEAVY_HAIKU", label: "IA moderada (~$0,05)", tone: "atencao" },
  { value: "SONNET_REQUIRED", label: "IA complexa (~$0,20)", tone: "erro" },
];

export function detectProcessingTypeClient(nome: string): string {
  const n = nome.toUpperCase().replace(/[_\-.]/g, " ");
  const headerOnly = [
    "PLANILHA", "CONTROLE DE ENTREGA", "CONTROLE DE TEMPERATURA", "CONTROLE DE LIMPEZA",
    "FICHA DE ANAMNESE", "FICHA ANAMNESE", "TERMO DE RENUNCIA", "TERMO RENUNCIA", "TERMO DE RECUSA", "ENCAMINHAMENTO",
  ];
  if (headerOnly.some((k) => n.includes(k))) return "HEADER_ONLY";
  const sonnet = [
    "INTERCORRENCIAS EMERGENCIAS",
    "INTERCORRENCIAS E EMERGENCIAS",
    "IMPLEMENTACAO DO PROCESSO",
    "PGRSS",
    "PLANO DE GERENCIAMENTO",
    "PCI",
    "PLANO DE CONTROLE DE INFECCAO",
    "PSP",
    "PLANO DE SEGURANCA",
    "MANUAL DE BOAS PRATICAS",
    "MBP",
    "RELACAO DE SERVICOS",
    "RELACAO SERVICOS",
    "POP",
    "PROCEDIMENTO OPERACIONAL PADRAO",
    "TCLE",
    "TERMO DE CONSENTIMENTO",
    "PROTOCOLO",
  ];
  if (sonnet.some((k) => n.includes(k))) return "SONNET_REQUIRED";
  const heavy = ["RELACAO DE EQUIPAMENTOS", "GUIA DE UTILIZACAO", "GUIA UTILIZACAO"];
  if (heavy.some((k) => n.includes(k))) return "HEAVY_HAIKU";
  return "LIGHT_HAIKU";
}

export function getPtInfo(processingType: string) {
  return PROCESSING_TYPES.find((p) => p.value === processingType) || PROCESSING_TYPES[1];
}
