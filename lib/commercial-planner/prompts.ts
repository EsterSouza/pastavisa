import type { CommercialPlannerInput, PlannerCatalogItem } from "./types";

export function buildPlannerPrompts(input: CommercialPlannerInput, catalog: PlannerCatalogItem[]) {
  const systemPrompt = `Você analisa declarações comerciais para um pré-planejamento sanitário brasileiro.
Responda somente JSON válido. Trabalhe apenas com o pedido atual e nunca use dados de outro cliente.
Não transforme produto, marca, ativo, indicação, equipamento, etapa, região corporal ou nome comercial em procedimento.
Uma técnica só pode ser procedimento quando estiver literalmente declarada. Preserve técnicas parecidas como itens distintos.
Use somente IDs do catálogo fornecido. Não invente documentos. Um TCLE de família só pode cobrir técnicas múltiplas quando execução, risco e consentimento forem materialmente equivalentes.
Esterilização só pode ser proposta quando reutilização, processamento e autoclave estiverem confirmados.`;

  const userPrompt = `PEDIDO ATUAL:
${JSON.stringify(input)}

CATÁLOGO INTERNO ATIVO:
${JSON.stringify(catalog)}

Retorne exatamente esta estrutura:
{
  "mentions": [{
    "name": "trecho identificado",
    "canonicalName": "nome técnico consolidado",
    "evidence": "trecho literal do pedido",
    "kind": "procedure|product|brand|active|indication|equipment|step|uncertain",
    "explicit": true
  }],
  "coverages": [{
    "catalogId": "id real ou null",
    "documentName": "nome do catálogo ou vazio",
    "documentType": "POP|TCLE|FICHA|PLANILHA|OUTROS",
    "role": "procedure|consent|record|general|sterilization|equipment",
    "techniques": ["nome técnico consolidado"],
    "mode": "exact|personalizable|family|new",
    "equivalent": false,
    "uncertain": false,
    "alert": "dúvida objetiva, se houver"
  }],
  "alerts": ["somente confirmações técnicas objetivas"]
}

Inclua todas as menções relevantes, mesmo as excluídas como produto ou marca. Em coverages, proponha o conjunto mínimo operacional. Para lacuna, use catalogId null e mode new. Não repita documentos equivalentes.`;

  return { systemPrompt, userPrompt };
}
