import type { CommercialPlannerInput, CoverageCandidate, DocumentRole } from "./types";

/**
 * Base obrigatória da pasta sanitária.
 *
 * Todo estabelecimento recebe um conjunto de documentos institucionais, POPs gerais
 * de biossegurança e registros de controle que não dependem de qual procedimento é
 * realizado. Eles entram sempre, independentemente das técnicas declaradas.
 *
 * Alguns dependem da estrutura declarada pelo próprio cliente — esterilização,
 * equipamentos, injetáveis, perfuração auricular — e por isso trazem `quando`.
 */

interface BaselineContext {
  input: CommercialPlannerInput;
  tecnicas: string[];
}

interface BaselineEntry {
  nome: string;
  tipo: string;
  role: DocumentRole;
  quando?: (contexto: BaselineContext) => boolean;
}

function texto(contexto: BaselineContext): string {
  return [contexto.tecnicas.join(" "), contexto.input.procedimentos]
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Procedimento com agulha, cânula ou ativo injetado na pele do paciente. */
function temInjetavel(contexto: BaselineContext): boolean {
  return /injet|toxina botulinica|preenchiment|acido hialuronico|bioestimulad|biorremodelad|fios de pdo|fio de pdo|skinbooster|intradermoterapia|mesoterapia|peim|escleroterapia|enzima|prp|plasma|pdrn|exossomo|soroterapia|ortomolecular|microagulhament|harmonizacao|rinomodelac|carboxiterapia|bioplastia|pmma/.test(
    texto(contexto)
  );
}

/** Perfuração de lóbulo, cartilagem ou body piercing. */
function temPerfuracao(contexto: BaselineContext): boolean {
  return /piercing|perfurac|furo de orelha|lobulo|auricular|otomodelac/.test(texto(contexto));
}

const BASE: BaselineEntry[] = [
  // Institucionais, gerenciais e de segurança.
  { nome: "Relação de Serviços, Equipamentos e Insumos Oferecidos", tipo: "RELAÇÃO", role: "general" },
  { nome: "Manual de Boas Práticas em Serviço de Saúde", tipo: "MBP", role: "general" },
  { nome: "Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS)", tipo: "PGRSS", role: "general" },
  { nome: "Plano de Segurança do Paciente", tipo: "PLANO", role: "general" },
  { nome: "Plano de Contingência e Emergências", tipo: "PLANO", role: "general" },

  // POPs gerais de biossegurança, limpeza, estrutura e controle.
  { nome: "POP — Higienização das Mãos", tipo: "POP", role: "general" },
  { nome: "POP — Paramentação e Uso de Equipamentos de Proteção Individual (EPIs)", tipo: "POP", role: "general" },
  {
    nome: "POP — Limpeza e Desinfecção de Superfícies, Mobiliários, Macas e Equipamentos de Apoio",
    tipo: "POP",
    role: "general",
  },
  { nome: "POP — Limpeza e Manutenção do Sistema de Climatização", tipo: "POP", role: "general" },
  { nome: "POP — Controle Integrado de Vetores e Pragas Urbanas", tipo: "POP", role: "general" },
  { nome: "POP — Gerenciamento Interno de Resíduos", tipo: "POP", role: "general" },
  { nome: "POP — Prevenção e Conduta em Acidentes com Material Biológico", tipo: "POP", role: "general" },
  { nome: "POP — Recebimento, Armazenamento, Organização e Controle de Produtos", tipo: "POP", role: "general" },
  { nome: "POP — Conduta em Intercorrências e Emergências", tipo: "POP", role: "general" },

  // Avaliação, registro e segurança assistencial.
  { nome: "POP — Consulta e Prontuário", tipo: "POP", role: "record" },
  { nome: "Ficha de Anamnese Estética Integrativa", tipo: "FICHA", role: "record" },

  // Termos que valem para o atendimento inteiro, não para uma técnica.
  { nome: "TCLE — Autorização para Uso de Imagem e Registro Fotográfico", tipo: "TCLE", role: "general" },
  { nome: "Termo de Recusa ou Encerramento de Tratamento ou Procedimento", tipo: "TERMO", role: "general" },

  // Planilhas, formulários e registros de controle.
  {
    nome: "Planilha de Rastreabilidade de Insumos, Produtos, Medicamentos e Lotes",
    tipo: "PLANILHA",
    role: "record",
  },
  { nome: "Planilha de Controle de Temperatura e Umidade", tipo: "PLANILHA", role: "record" },
  { nome: "Planilha de Controle de Limpeza Concorrente e Terminal", tipo: "PLANILHA", role: "record" },
  { nome: "Controle de Entrega de Orientações Pós-Procedimentos", tipo: "PLANILHA", role: "record" },
  { nome: "Formulário de Intercorrências e Eventos Adversos", tipo: "FORMULÁRIO", role: "record" },
  { nome: "Formulário de Encaminhamento Profissional", tipo: "FORMULÁRIO", role: "record" },
  { nome: "Guia de Utilização da Pasta Sanitária", tipo: "GUIA", role: "general" },

  // Dependentes do que o cliente declarou.
  { nome: "POP — Limpeza do Refrigerador Clínico", tipo: "POP", role: "general", quando: temInjetavel },
  { nome: "POP — Rastreabilidade de Injetáveis, Lotes e Insumos", tipo: "POP", role: "general", quando: temInjetavel },
  {
    nome: "POP — Prevenção e Conduta Inicial em Oclusão Vascular",
    tipo: "POP",
    role: "record",
    quando: temInjetavel,
  },
  {
    nome: "Ficha de Anamnese para Injetáveis e Harmonização",
    tipo: "FICHA",
    role: "record",
    quando: temInjetavel,
  },
  {
    nome: "Ficha de Anamnese para Procedimentos Auriculares e Body Piercing",
    tipo: "FICHA",
    role: "record",
    quando: temPerfuracao,
  },
  {
    nome: "POP — Uso de Materiais Descartáveis e Controle de Materiais de Uso Único",
    tipo: "POP",
    role: "general",
    quando: ({ input }) => input.reutilizaMateriais === false,
  },
  {
    nome: "POP — Gestão e Manutenção de Equipamentos Eletromédicos",
    tipo: "POP",
    role: "equipment",
  },
  {
    nome: "POP — Processamento, Limpeza e Desinfecção de Artigos, Instrumentais e Materiais Reutilizáveis",
    tipo: "POP",
    role: "sterilization",
  },
  {
    nome: "POP — Validação e Monitoramento do Processo de Esterilização",
    tipo: "POP",
    role: "sterilization",
  },
  { nome: "Registro de Esterilização em Autoclave", tipo: "REGISTRO", role: "sterilization" },
];

/**
 * Documentos da base obrigatória para esta operação. Saem já com o nome final e sem
 * técnica vinculada: são os que permanecem quando o comercial retira procedimentos.
 *
 * As entradas de equipamento e esterilização passam ainda pelo mesmo corte de
 * `buildMinimumPlan`, que confere autoclave, reutilização e equipamentos declarados.
 */
export function buildBaselineDocuments(
  input: CommercialPlannerInput,
  tecnicas: string[]
): CoverageCandidate[] {
  const contexto: BaselineContext = { input, tecnicas };

  return BASE.filter((entrada) => !entrada.quando || entrada.quando(contexto)).map((entrada) => ({
    key: `base:${entrada.tipo}:${entrada.nome}`,
    catalogId: null,
    documentName: entrada.nome,
    documentType: entrada.tipo,
    role: entrada.role,
    techniques: [],
    mode: "exact" as const,
    equivalent: false,
    uncertain: false,
  }));
}
