import type { SecaoDocumentos } from "./tipos";

// Regras fixas do planejamento, tiradas dos três planejamentos mais recentes da
// Ester (Aline Lima 12/10, Guerra Guirra 08/10 e Camila Cavalli 05/10/2026) e da
// skill dela. Ficam em código, e não na IA, porque não mudam de cliente para cliente.

export const SECAO_INSTITUCIONAL = "DOCUMENTOS INSTITUCIONAIS, GERENCIAIS E DE SEGURANÇA";
export const SECAO_ROTINAS = "POPs - ROTINAS GERAIS DE BIOSSEGURANÇA, LIMPEZA, ESTRUTURA E CONTROLE";
export const SECAO_ASSISTENCIAL = "POPs - AVALIAÇÃO, REGISTRO E SEGURANÇA ASSISTENCIAL";
export const SECAO_FICHAS = "FICHAS DE ANAMNESE E AVALIAÇÃO";
export const SECAO_TCLES = "TERMOS DE CONSENTIMENTO LIVRE E ESCLARECIDO E TERMOS CORRELATOS";
export const SECAO_PLANILHAS = "PLANILHAS, FORMULÁRIOS E REGISTROS DE CONTROLE";

/** Títulos já usados para os grupos de POPs de procedimento; a IA escolhe entre eles. */
export const SECOES_DE_PROCEDIMENTO = [
  "POPs - PROCEDIMENTOS ESTÉTICOS E TECNOLOGIAS",
  "POPs - PROCEDIMENTOS FACIAIS, CORPORAIS E CAPILARES",
  "POPs - PROCEDIMENTOS ESTÉTICOS INJETÁVEIS",
  "POPs - RECURSOS TERAPÊUTICOS MANUAIS, ELETROTERAPIA E REABILITAÇÃO",
  "POPs - PRÁTICAS INTEGRATIVAS E COMPLEMENTARES",
];

export const GRUPOS_REFERENCIAS = {
  federal: "LEGISLAÇÃO FEDERAL",
  anvisa: "NORMAS SANITÁRIAS DA ANVISA E GESTÃO DE RESÍDUOS",
  trabalho: "INFRAESTRUTURA, ÁGUA E SAÚDE E SEGURANÇA DO TRABALHO",
  manuais: "MANUAIS E PROTOCOLOS TÉCNICOS INSTITUCIONAIS",
} as const;

/** Documentos que nunca entram (regra expressa da Ester). */
const NUNCA = [
  /\bPOP\b.*descart[aá]ve/i,
  /\bPOP\b.*uso [uú]nico/i,
  /\bPOP\b.*encaminhamento profissional/i,
  /\bcontrato\b/i,
  /\bPOP\b.*acompanhamento pr[eé] e p[oó]s/i,
];

export function nuncaEntra(nome: string): boolean {
  return NUNCA.some((re) => re.test(nome));
}

const PSP = "Plano de Segurança do Paciente";
const POP_INTERCORRENCIAS = "POP - Intercorrências Assistenciais e Encaminhamento de Urgência";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function garantir(secoes: SecaoDocumentos[], titulo: string, item: string, existe: RegExp, posicao?: number) {
  let secao = secoes.find((s) => s.titulo === titulo);
  if (!secao) {
    secao = { titulo, itens: [] };
    secoes.push(secao);
  }
  if (secoes.some((s) => s.itens.some((i) => existe.test(i)))) return;
  if (posicao === undefined || posicao >= secao.itens.length) secao.itens.push(item);
  else secao.itens.splice(posicao, 0, item);
}

const ORDEM_FIXA = [SECAO_INSTITUCIONAL, SECAO_ROTINAS, SECAO_ASSISTENCIAL];
const ORDEM_FINAL = [SECAO_FICHAS, SECAO_TCLES, SECAO_PLANILHAS];

/**
 * Aplica as regras que não dependem da IA: tira o que nunca entra e os repetidos,
 * garante PSP e POP de intercorrências em serviço de saúde, e põe as seções na
 * ordem dos planejamentos dela (as de procedimento ficam entre as assistenciais e as fichas).
 */
export function aplicarRegras(secoesIa: SecaoDocumentos[], servicoDeSaude: boolean): {
  secoes: SecaoDocumentos[];
  removidos: string[];
} {
  const removidos: string[] = [];
  const vistos = new Set<string>();
  const secoes: SecaoDocumentos[] = [];

  for (const secao of secoesIa) {
    const titulo = secao.titulo.trim().replace(/\s+—\s+/g, " - ");
    const itens: string[] = [];
    for (const bruto of secao.itens) {
      const item = bruto.trim().replace(/^(POP|TCLE)\s+—\s+/, "$1 - ");
      if (!item) continue;
      if (nuncaEntra(item)) {
        removidos.push(item);
        continue;
      }
      const chave = normalizar(item);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      itens.push(item);
    }
    const existente = secoes.find((s) => s.titulo === titulo);
    if (existente) existente.itens.push(...itens);
    else secoes.push({ titulo, itens });
  }

  if (servicoDeSaude) {
    garantir(secoes, SECAO_INSTITUCIONAL, PSP, /seguran[cç]a do paciente|\bPSP\b/i, 3);
    garantir(secoes, SECAO_ASSISTENCIAL, POP_INTERCORRENCIAS, /^POP\b.*intercorr[eê]ncia/i);
  }

  const peso = (titulo: string) => {
    const fixa = ORDEM_FIXA.indexOf(titulo);
    if (fixa >= 0) return fixa;
    const final = ORDEM_FINAL.indexOf(titulo);
    if (final >= 0) return 100 + final;
    const procedimento = SECOES_DE_PROCEDIMENTO.indexOf(titulo);
    return 10 + (procedimento >= 0 ? procedimento : SECOES_DE_PROCEDIMENTO.length);
  };
  secoes.sort((a, b) => peso(a.titulo) - peso(b.titulo));

  return { secoes: secoes.filter((s) => s.itens.length), removidos };
}
