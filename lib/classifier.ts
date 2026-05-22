export type ProcessingType = "HEADER_ONLY" | "LIGHT_HAIKU" | "HEAVY_HAIKU" | "SONNET_REQUIRED";

export const PROCESSING_TYPE_LABELS: Record<ProcessingType, string> = {
  HEADER_ONLY:      "Sem IA — só substituição (R$ 0)",
  LIGHT_HAIKU:      "IA leve — Haiku (R$ 0,01–0,05)",
  HEAVY_HAIKU:      "IA moderada — Haiku (R$ 0,05–0,15)",
  SONNET_REQUIRED:  "IA avançada — Sonnet (R$ 0,30–0,80)",
};

export function detectProcessingType(templateName: string): ProcessingType {
  const nome = templateName
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_\-.]/g, " ");

  // ── HEADER_ONLY — zero IA, só substituição docxtemplater ─────────────────
  const headerOnly = [
    "PLANILHA",
    "CONTROLE DE ENTREGA",
    "CONTROLE DE TEMPERATURA",
    "CONTROLE DE LIMPEZA",
    "REGISTRO DE ESTERILIZACAO",
    "REGISTRO DE LIMPEZA",
    "RASTREABILIDADE",
    "FICHA DE ANAMNESE",
    "FICHA ANAMNESE",
    "FICHA DE PLANEJAMENTO",
    "FICHA DE AVALIACAO",
    "FICHA AVALIACAO",
    "TERMO DE AUTORIZACAO",
    "TERMO DE RENUNCIA",
    "TERMO RENUNCIA",
    "TERMO DE RECUSA",
    "ENCAMINHAMENTO",
    "FORMULARIO DE NOTIFICACAO",
  ];
  if (headerOnly.some((k) => nome.includes(k))) return "HEADER_ONLY";

  // ── SONNET_REQUIRED — documentos técnicos e clínicos de alta complexidade ─
  // Estes documentos exigem raciocínio contextual profundo, linguagem técnica
  // impecável e conformidade regulatória estrita. Qualquer erro pode gerar
  // não-conformidade em auditoria sanitária — use o melhor modelo disponível.
  const sonnet = [
    // Clínico / emergência
    "IMPLEMENTACAO DO PROCESSO DE ENFERMAGEM",
    "SAE",
    "PROTOCOLO DE INTERCORRENCIAS E EMERGENCIAS MEDICAS",
    "INTERCORRENCIAS EMERGENCIAS",
    "INTERCORRENCIAS E EMERGENCIAS",
    // Gestão de resíduos — regulatório crítico (RDC 222/2018)
    "PGRSS",
    "PLANO DE GERENCIAMENTO DE RESIDUOS",
    "PLANO DE GERENCIAMENTO",
    // Controle de infecção e segurança do paciente
    "PLANO DE CONTROLE DE INFECCAO",
    "PCI",
    "PLANO DE SEGURANCA DO PACIENTE",
    "PSP",
    // Manuais e relações de serviços — narrativa técnica extensa
    "MANUAL DE BOAS PRATICAS",
    "MBP",
    "RELACAO DE SERVICOS",
    "RELACAO SERVICOS",
    // Protocolos clínicos específicos
    "PROTOCOLO DE ATENDIMENTO",
    "PROTOCOLO CLINICO",
    "PROTOCOLO DE HIGIENIZACAO",
    "PROTOCOLO DE ESTERILIZACAO",
    "PROTOCOLO DE DESINFECCAO",
  ];
  if (sonnet.some((k) => nome.includes(k))) return "SONNET_REQUIRED";

  // ── HEAVY_HAIKU — múltiplos blocos AI_ADAPT, conteúdo moderado ───────────
  const heavy = [
    "RELACAO DE EQUIPAMENTOS E SERVICOS",
    "GUIA DE UTILIZACAO",
    "GUIA UTILIZACAO",
    "ORIENTACOES POS",
    "ORIENTACOES DE USO",
  ];
  if (heavy.some((k) => nome.includes(k))) return "HEAVY_HAIKU";

  // ── LIGHT_HAIKU — padrão para POPs técnicos, TCLEs, receituário ──────────
  return "LIGHT_HAIKU";
}

// Map processing type to Claude model
export function modelForType(processingType: ProcessingType): string {
  return processingType === "SONNET_REQUIRED"
    ? "claude-sonnet-4-6"
    : "claude-haiku-4-5-20251001";
}
