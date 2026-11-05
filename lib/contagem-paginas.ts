export type DocumentoContado = { nome: string; paginas: number };

/** Franquia mensal da impressora da Ester (R$ 245 até 2.500 páginas). */
export const FRANQUIA_PAGINAS = 2500;

/** Dia em que a franquia da impressora recomeça. */
export const DIA_DA_FRANQUIA = 21;

/**
 * Ciclo da franquia (dia 21 até o dia 20 do mês seguinte), no fuso do navegador.
 * A chave é o ano-mês em que o ciclo começa: 20/11 cai em "2026-10", 21/11 em "2026-11".
 */
export function cicloDe(data: string | Date): string {
  const d = new Date(data);
  const inicio = new Date(d.getFullYear(), d.getMonth() - (d.getDate() < DIA_DA_FRANQUIA ? 1 : 0), 1);
  return `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}`;
}

/** "21/10 a 20/11/2026" */
export function nomeDoCiclo(ciclo: string): string {
  const [ano, mes] = ciclo.split("-").map(Number);
  const fim = new Date(ano, mes, DIA_DA_FRANQUIA - 1);
  const dd = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${dd(new Date(ano, mes - 1, DIA_DA_FRANQUIA))} a ${dd(fim)}/${fim.getFullYear()}`;
}

/** Pasta que vai para a gráfica: a versão do planejamento cita colorida ou preto e branco. */
export function pastaImpressa(versao: string | null | undefined): boolean {
  return /colorid|preto/i.test(versao || "");
}

/**
 * Custos de produção informados pela Ester em 05/11/2026. A IA é estimada pelos
 * tokens do banco em outubro (Sonnet 4.6 na geração + Opus 5.5 no planejamento).
 */
export const CUSTOS = {
  kevinMes: 400,
  impressoraMes: 245,
  papelPorPagina: 20 / 500,
  pastaCatalogo: 25,
  envio: 30,
  pix: 2.5,
  imposto: 0.06,
  iaPorPasta: 19,
};

export function precoDaPasta(versao: string | null | undefined): number {
  if (/colorid/i.test(versao || "")) return 957;
  if (/preto/i.test(versao || "")) return 797;
  return 597;
}

export type CustoPasta = { preco: number; itens: Array<[string, number]>; custo: number; sobra: number };

/**
 * Custo de uma pasta. O Kevin é dividido por todas as pastas contadas no mês, e a
 * impressora só pelas impressas. ponytail: pasta não contada não entra na divisão,
 * então o rateio só é fiel se toda pasta do mês, digital inclusive, for contada.
 */
export function custoDaPasta(
  pasta: { versao: string | null; paginas: number },
  doMes: Array<{ versao: string | null }>
): CustoPasta {
  const preco = precoDaPasta(pasta.versao);
  const itens: Array<[string, number]> = [
    ["Imposto (6%)", preco * CUSTOS.imposto],
    ["Pix (Cakto)", CUSTOS.pix],
    ["Kevin", CUSTOS.kevinMes / Math.max(doMes.length, 1)],
    ["IA (estimada)", CUSTOS.iaPorPasta],
  ];
  if (pastaImpressa(pasta.versao)) {
    itens.push(
      ["Impressora", CUSTOS.impressoraMes / Math.max(doMes.filter((p) => pastaImpressa(p.versao)).length, 1)],
      ["Papel", pasta.paginas * CUSTOS.papelPorPagina],
      ["Pasta catálogo", CUSTOS.pastaCatalogo],
      ["Envio", CUSTOS.envio]
    );
  }
  const custo = itens.reduce((soma, [, valor]) => soma + valor, 0);
  return { preco, itens, custo, sobra: preco - custo };
}

/** Colunas de custo da planilha, na ordem de custoDaPasta. */
export const ITENS_DE_CUSTO = ["Imposto (6%)", "Pix (Cakto)", "Kevin", "IA (estimada)", "Impressora", "Papel", "Pasta catálogo", "Envio"];

/**
 * Planilha para o Excel em português: separador ";", vírgula decimal e BOM para os
 * acentos. Texto que começa com = + - @ ganha apóstrofo para o Excel não rodar fórmula.
 */
export function planilhaCsv(linhas: Array<Array<string | number>>): string {
  const celula = (valor: string | number) => {
    if (typeof valor === "number") return Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace(".", ",");
    const texto = /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
    return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return "\uFEFF" + linhas.map((linha) => linha.map(celula).join(";")).join("\r\n");
}

export const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Tipo do documento pelo nome do PDF, para a média de páginas por tipo. */
export function tipoDoDocumento(nome: string): string {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (/\bTCLE\b|TERMO DE CONSENTIMENTO/.test(n)) return "TCLE";
  if (/MANUAL DE BOAS|\bMBP\b/.test(n)) return "MBP";
  if (/PGRSS|GERENCIAMENTO DE RESIDUOS/.test(n)) return "PGRSS";
  if (/SEGURANCA DO PACIENTE|\bPSP\b/.test(n)) return "PSP";
  if (/\bPOP\b/.test(n)) return "POP";
  if (/FICHA|ANAMNESE/.test(n)) return "Ficha";
  if (/PLANILHA|CONTROLE|REGISTRO/.test(n)) return "Planilha";
  if (/\bPLANO\b/.test(n)) return "Outros planos";
  if (/\bTERMO\b/.test(n)) return "Outros termos";
  return "Outros";
}

/** Lista vinda do navegador: só aceita nome e número de páginas válidos. */
export function lerDocumentos(valor: unknown): DocumentoContado[] | null {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > 500) return null;
  const lista: DocumentoContado[] = [];
  for (const item of valor) {
    const nome = typeof item?.nome === "string" ? item.nome.trim().slice(0, 300) : "";
    const paginas = item?.paginas;
    if (!nome || !Number.isInteger(paginas) || paginas < 1 || paginas > 2000) return null;
    lista.push({ nome, paginas });
  }
  return lista;
}
