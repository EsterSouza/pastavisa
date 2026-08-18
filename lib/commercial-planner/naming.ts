import type { DocumentRole } from "./types";

/**
 * Nome público dos documentos da pasta.
 *
 * O nome que o comercial e o cliente leem é o nome oficial do documento, escrito
 * como a equipe técnica o nomeia na pasta entregue. Ele nunca é o nome do arquivo
 * de origem, que varia em caixa, acentuação e abreviação.
 *
 * POP e TCLE de procedimento são nomeados a partir da própria técnica declarada
 * pelo cliente, não do arquivo de origem: assim o nome sai certo inclusive quando
 * a técnica ainda não tem documento correspondente e a equipe vai elaborá-lo.
 */

export interface CanonicalDocument {
  nome: string;
  tipo: string;
}

interface CanonicalEntry extends CanonicalDocument {
  origens: string[];
}

function chave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const CANONICOS: CanonicalEntry[] = [
  // Institucionais, gerenciais e de segurança.
  {
    nome: "Relação de Serviços, Equipamentos e Insumos Oferecidos",
    tipo: "RELAÇÃO",
    origens: ["Relacao Servicos Equipamentos"],
  },
  {
    nome: "Manual de Boas Práticas em Serviço de Saúde",
    tipo: "MBP",
    origens: ["MBP Servico Saude"],
  },
  {
    nome: "Manual de Boas Práticas em Serviço de Embelezamento",
    tipo: "MBP",
    origens: ["MBP Embelezamento"],
  },
  {
    nome: "Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS)",
    tipo: "PGRSS",
    origens: ["PGRSS"],
  },
  { nome: "Plano de Segurança do Paciente", tipo: "PLANO", origens: ["PSP"] },
  { nome: "Plano de Contingência e Emergências", tipo: "PLANO", origens: ["Plano Contingencia"] },
  {
    nome: "Regulamento Interno de Profissionais Parceiros e Uso Compartilhado do Espaço",
    tipo: "REGULAMENTO",
    origens: ["REGULAMENTO INTERNO PROFISSIONAIS PARCEIROS E USO COMPARTILHADO DO ESPACO"],
  },

  // POPs de biossegurança, limpeza, estrutura e controle.
  { nome: "POP — Higienização das Mãos", tipo: "POP", origens: ["POP Higienizacao Maos"] },
  {
    nome: "POP — Paramentação e Uso de Equipamentos de Proteção Individual (EPIs)",
    tipo: "POP",
    origens: ["POP Uso EPIs"],
  },
  {
    nome: "POP — Limpeza e Desinfecção de Superfícies, Mobiliários, Macas e Equipamentos de Apoio",
    tipo: "POP",
    origens: ["POP Limpeza Superficies"],
  },
  { nome: "POP — Limpeza do Refrigerador Clínico", tipo: "POP", origens: ["POP Limpeza Refrigerador"] },
  {
    nome: "POP — Limpeza e Manutenção do Sistema de Climatização",
    tipo: "POP",
    origens: ["POP - LIMPEZA E MANUTENCAO CLIMATIZACAO"],
  },
  {
    nome: "POP — Controle Integrado de Vetores e Pragas Urbanas",
    tipo: "POP",
    origens: ["POP Controle Vetores Pragas"],
  },
  { nome: "POP — Gerenciamento Interno de Resíduos", tipo: "POP", origens: ["POP Gerenciamento Residuos"] },
  {
    nome: "POP — Prevenção e Conduta em Acidentes com Material Biológico",
    tipo: "POP",
    origens: ["POP Acidentes Material Biologico"],
  },
  {
    nome: "POP — Recebimento, Armazenamento, Organização e Controle de Produtos",
    tipo: "POP",
    origens: ["POP Recebimento Armazenamento"],
  },
  {
    nome: "POP — Rastreabilidade de Injetáveis, Lotes e Insumos",
    tipo: "POP",
    origens: ["POP RASTREABILIDADE DE INJETAVEIS LOTES E INSUMOS"],
  },
  {
    nome: "POP — Uso de Materiais Descartáveis e Controle de Materiais de Uso Único",
    tipo: "POP",
    origens: [],
  },
  {
    nome: "POP — Gestão e Manutenção de Equipamentos Eletromédicos",
    tipo: "POP",
    origens: ["POP Manutencao Equipamentos", "POP - GESTAO DE EQUIPAMENTOS"],
  },
  {
    nome: "POP — Gestão de Segurança em Laser e LED",
    tipo: "POP",
    origens: ["POP - GESTAO DE SEGURANCA LASER E LED"],
  },
  { nome: "POP — Controle da Potabilidade da Água", tipo: "POP", origens: ["POP CONTROLE POTABILIDADE AGUA"] },
  { nome: "POP — Limpeza do Purificador de Água", tipo: "POP", origens: ["POP LIMPEZA PURIFICADOR AGUA"] },
  {
    nome: "POP — Processamento, Limpeza e Desinfecção de Artigos, Instrumentais e Materiais Reutilizáveis",
    tipo: "POP",
    origens: ["POP Processamento Materiais"],
  },
  {
    nome: "POP — Validação e Monitoramento do Processo de Esterilização",
    tipo: "POP",
    origens: ["POP VALIDACAO E MONITORAMENTO DA ESTERILIZACAO"],
  },

  // POPs de avaliação, registro e segurança assistencial.
  { nome: "POP — Consulta e Prontuário", tipo: "POP", origens: ["POP - CONSULTA E PRONTUARIO"] },
  {
    nome: "POP — Prevenção e Conduta Inicial em Oclusão Vascular",
    tipo: "POP",
    origens: ["POP Prevencao Oclusao Vascular"],
  },
  {
    nome: "POP — Conduta em Intercorrências e Emergências",
    tipo: "POP",
    origens: ["POP Intercorrencias Emergencias"],
  },
  {
    nome: "POP — Acompanhamento Pré e Pós-Procedimento Estético",
    tipo: "POP",
    origens: ["POP ACOMPANHAMENTO PRE E POS PROCEDIMENTO ESTETICO"],
  },

  // Fichas de anamnese e avaliação.
  {
    nome: "Ficha de Anamnese Estética Integrativa",
    tipo: "FICHA",
    origens: ["FICHA ANAMNESE ESTETICA INTEGRATIVA"],
  },
  { nome: "Ficha de Anamnese Facial", tipo: "FICHA", origens: ["Ficha Anamnese Facial"] },
  { nome: "Ficha de Anamnese Corporal", tipo: "FICHA", origens: ["Ficha Anamnese Corporal"] },
  {
    nome: "Ficha de Anamnese para Injetáveis e Harmonização",
    tipo: "FICHA",
    origens: ["Ficha Anamnese Injetaveis Harmonizacao", "Ficha Anamnese Injetaveis"],
  },
  {
    nome: "Ficha de Anamnese para Procedimentos Auriculares e Body Piercing",
    tipo: "FICHA",
    origens: ["FICHA ANAMNESE PROCEDIMENTOS AURICULARES BODY PIERCING"],
  },
  {
    nome: "Ficha de Anamnese e Avaliação para Terapias Injetáveis e Soroterapia",
    tipo: "FICHA",
    origens: ["FICHA - ANAMNESE E AVALIACAO TERAPIAS INJETAVEIS E SOROTERAPIA"],
  },
  { nome: "Ficha de Anamnese em Saúde da Mulher", tipo: "FICHA", origens: ["FICHA DE ANAMNESE SAUDE DA MULHER"] },
  {
    nome: "Ficha de Anamnese para Micropigmentação Labial",
    tipo: "FICHA",
    origens: ["Ficha Anamnese Micropigmentacao Labios"],
  },
  { nome: "Ficha de Avaliação Nutricional", tipo: "FICHA", origens: ["FICHA - AVALIACAO NUTRICIONAL"] },
  { nome: "Ficha de Avaliação Podológica", tipo: "FICHA", origens: ["FICHA DE AVALIACAO PODOLOGICA"] },
  {
    nome: "Ficha de Avaliação Pediátrica para Furo de Orelha",
    tipo: "FICHA",
    origens: ["FICHA - AVALIACAO PEDIATRICA FURO ORELHA"],
  },
  {
    nome: "Ficha de Avaliação para Remoção de Pigmentação Estética",
    tipo: "FICHA",
    origens: ["FICHA - AVALIACAO REMOCAO DE PIGMENTACAO ESTETICA"],
  },
  {
    nome: "Ficha de Avaliação Corporal e Pós-Operatório",
    tipo: "FICHA",
    origens: ["FICHA DE AVALIACAO CORPORAL E POS OPERATORIO"],
  },
  {
    nome: "POP — Aferição e Monitoramento de Sinais Vitais",
    tipo: "POP",
    origens: ["POP - AFERICAO E MONITORAMENTO DE SINAIS VITAIS"],
  },
  {
    nome: "POP — Prevenção e Tratamento de Intercorrências Venosas",
    tipo: "POP",
    origens: ["POP - PREVENCAO E TRATAMENTO DE INTERCORRENCIAS VENOSAS"],
  },
  {
    nome: "POP — Implementação do Processo de Enfermagem",
    tipo: "POP",
    origens: ["POP - PROCESSO DE ENFERMAGEM"],
  },
  { nome: "POP — Consulta de Enfermagem", tipo: "POP", origens: ["POP - CONSULTA DE ENFERMAGEM"] },
  { nome: "POP — Prescrição de Enfermagem", tipo: "POP", origens: ["POP - PRESCRICAO DE ENFERMAGEM"] },

  // Termos gerais.
  {
    nome: "TCLE — Autorização para Uso de Imagem e Registro Fotográfico",
    tipo: "TCLE",
    origens: ["TCLE Uso Imagem LGPD"],
  },
  {
    nome: "Termo de Recusa ou Encerramento de Tratamento ou Procedimento",
    tipo: "TERMO",
    origens: ["Termo Renuncia Recusa Tratamento"],
  },

  // Planilhas, formulários e registros de controle.
  {
    nome: "Planilha de Rastreabilidade de Insumos, Produtos, Medicamentos e Lotes",
    tipo: "PLANILHA",
    origens: ["PLANILHA RASTREABILIDADE PRODUTOS"],
  },
  {
    nome: "Planilha de Controle de Temperatura e Umidade",
    tipo: "PLANILHA",
    origens: ["Planilha Controle Temperatura"],
  },
  {
    nome: "Planilha de Controle de Limpeza Concorrente e Terminal",
    tipo: "PLANILHA",
    origens: ["Planilha Limpeza Desinfeccao"],
  },
  {
    nome: "Controle de Entrega de Orientações Pós-Procedimentos",
    tipo: "PLANILHA",
    origens: ["Controle Entrega Pos Procedimento", "Controle Orientações Pos"],
  },
  {
    nome: "Formulário de Intercorrências e Eventos Adversos",
    tipo: "FORMULÁRIO",
    origens: ["FORM EVENTO ADVERSO"],
  },
  {
    nome: "Protocolo de Intercorrências em Serviço Não Invasivo",
    tipo: "PROTOCOLO",
    origens: ["PROTOCOLO INTERCORRENCIAS SERVICO NAO INVASIVO"],
  },
  {
    nome: "Formulário de Encaminhamento Profissional",
    tipo: "FORMULÁRIO",
    origens: ["Encaminhamento Profissional"],
  },
  { nome: "Registro de Esterilização em Autoclave", tipo: "REGISTRO", origens: ["REGISTRO ESTERILIZACAO"] },
  { nome: "Guia de Utilização da Pasta Sanitária", tipo: "GUIA", origens: ["Guia Utilizacao Pasta Sanitaria"] },
];

const INDICE = new Map<string, CanonicalDocument>();
for (const entrada of CANONICOS) {
  const documento: CanonicalDocument = { nome: entrada.nome, tipo: entrada.tipo };
  // O próprio nome canônico entra no índice para a conversão ser idempotente:
  // documentos da base obrigatória já nascem com o nome final.
  for (const origem of [entrada.nome, ...entrada.origens]) INDICE.set(chave(origem), documento);
}

/**
 * Nome e tipo públicos de um documento que não nasce de uma técnica declarada.
 *
 * Devolve null quando o documento não tem verbete. A lista acima é fechada de
 * propósito: documento que não nasce de uma técnica declarada só chega ao cliente
 * se for um documento que a pasta realmente entrega. Consertar a caixa e deixar
 * passar o que veio da origem já pôs na frente do cliente documento que não
 * existe em planejamento nenhum.
 */
export function officialDocument(nome: string): CanonicalDocument | null {
  return INDICE.get(chave(nome)) ?? null;
}

/** Todos os nomes oficiais, para a base obrigatória conferir que nenhum ficou de fora. */
export function officialDocumentNames(): string[] {
  return CANONICOS.map((entrada) => entrada.nome);
}

/**
 * Nome do POP ou do TCLE a partir das técnicas que ele atende. Várias técnicas em um
 * documento só acontecem quando execução, risco e consentimento são equivalentes, e
 * nesse caso o nome cita todas, como a equipe escreve na pasta.
 */
export function procedureDocumentName(tipo: string, tecnicas: readonly string[]): string {
  const nomes = tecnicas.filter(Boolean);
  if (nomes.length === 0) return tipo;
  const lista =
    nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `${tipo.toUpperCase()} — ${lista}`;
}

/** Papéis cujo nome vem da técnica declarada, e não do documento de origem. */
export function nameFromTechnique(role: DocumentRole): boolean {
  return role === "procedure" || role === "consent";
}
