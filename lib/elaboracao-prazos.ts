// Lê do "Documentos em Elaboração" os dados de cabeçalho que a Ester sempre preenche:
// datas do projeto, versão da pasta e cor de fundo da logomarca. O texto variou ao
// longo dos meses ("Período de apreciação", "Prazo para apreciação", "Período de
// apreciação dos documentos"; datas com e sem ano), então cada campo aceita as
// variantes vistas nos documentos reais.

export interface PrazosElaboracao {
  /** Datas em ISO (AAAA-MM-DD). */
  inicioProjeto?: string;
  apreciacaoInicio?: string;
  apreciacaoFim?: string;
  entregaFinal?: string;
  versaoPasta?: string;
  /** Hex sem "#", em maiúsculas. Só vem quando o documento traz um hex de verdade. */
  logoBgHex?: string;
}

const DATA = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g;

function itens(texto: string): Array<{ rotulo: string; valor: string }> {
  return texto
    .split(/\r?\n|•|▪/)
    .map((linha) => linha.trim().match(/^([^:]{3,90}):\s*(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ rotulo: m[1].trim(), valor: m[2].trim() }));
}

function iso(ano: number, mes: number, dia: number): string | undefined {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return undefined;
  return d.toISOString().slice(0, 10);
}

/** Datas do valor, completando o ano que falta com o ano de referência (virada de ano incluída). */
function datas(valor: string, referencia: Date): string[] {
  const out: string[] = [];
  for (const m of Array.from(valor.matchAll(DATA))) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    let ano = m[3] ? Number(m[3]) : referencia.getUTCFullYear();
    if (ano < 100) ano += 2000;
    if (!m[3] && mes < referencia.getUTCMonth() + 1 - 6) ano += 1;
    const data = iso(ano, mes, dia);
    if (data) out.push(data);
  }
  return out;
}

export function extrairPrazosElaboracao(texto: string, referencia: Date = new Date()): PrazosElaboracao {
  const lista = itens(texto);
  const prazos: PrazosElaboracao = {};

  const inicio = lista.find((i) => /data (de )?in[íi]cio|data deste planejamento/i.test(i.rotulo));
  if (inicio) {
    prazos.inicioProjeto = datas(inicio.valor, referencia)[0];
  }
  const ref = prazos.inicioProjeto ? new Date(`${prazos.inicioProjeto}T12:00:00Z`) : referencia;

  const apreciacao = lista.find((i) => /aprecia[çc][ãa]o/i.test(i.rotulo));
  if (apreciacao) {
    const [primeira, ...resto] = datas(apreciacao.valor, ref);
    prazos.apreciacaoInicio = primeira;
    prazos.apreciacaoFim = resto[resto.length - 1] || primeira;
  }

  const entrega = lista.find(
    (i) => /entrega/i.test(i.rotulo) && /final|gr[áa]fica/i.test(i.rotulo) && !/aprecia/i.test(i.rotulo)
  );
  if (entrega) {
    const lidas = datas(entrega.valor, ref);
    prazos.entregaFinal = lidas[lidas.length - 1];
  }

  const versao = lista.find((i) => /^vers[ãa]o da pasta/i.test(i.rotulo));
  if (versao?.valor) prazos.versaoPasta = versao.valor.replace(/&amp;/g, "&").replace(/[.;]+$/, "");

  const cor = lista.find((i) => /cor(es)?( de)? fundo/i.test(i.rotulo));
  const hex = cor?.valor.match(/#?\b([0-9a-f]{6})\b/i);
  if (hex) prazos.logoBgHex = hex[1].toUpperCase();

  return prazos;
}

/** Data ISO (AAAA-MM-DD) para gravar no banco ao meio-dia UTC, longe da virada de fuso. */
export function dataDoBanco(valor: string | undefined | null): Date | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00Z`) : null;
}

/**
 * Relê o "Documentos em Elaboração" guardado na pasta e grava as datas e a versão.
 * A cor da logo só entra quando a pasta ainda não tem uma: a que a Ester digitou ou a
 * detectada na logo enviada vale mais que a do planejamento. Sempre marca
 * `prazosLidosEm`, mesmo sem achar nada, para a lista não reler o mesmo arquivo.
 */
export async function lerPrazosDaPasta(pastaId: string): Promise<PrazosElaboracao> {
  const { prisma } = await import("@/lib/prisma");
  const { readStorageBuffer } = await import("@/lib/file-storage");
  const { extractDocxTextFromBuffer } = await import("@/lib/extractor");

  const pasta = await prisma.pasta.findUnique({
    where: { id: pastaId },
    select: { documentosElaboracaoPath: true, criadaEm: true, clienteLogoBgHex: true },
  });
  if (!pasta) return {};

  let prazos: PrazosElaboracao = {};
  if (pasta.documentosElaboracaoPath) {
    try {
      const texto = await extractDocxTextFromBuffer(await readStorageBuffer(pasta.documentosElaboracaoPath));
      prazos = extrairPrazosElaboracao(texto, pasta.criadaEm);
    } catch (error) {
      console.warn(`[prazos] não foi possível ler o documento da pasta ${pastaId}:`, error);
    }
  }

  await prisma.pasta.update({
    where: { id: pastaId },
    data: {
      inicioProjeto: dataDoBanco(prazos.inicioProjeto),
      apreciacaoInicio: dataDoBanco(prazos.apreciacaoInicio),
      apreciacaoFim: dataDoBanco(prazos.apreciacaoFim),
      entregaFinal: dataDoBanco(prazos.entregaFinal),
      versaoPasta: prazos.versaoPasta || null,
      ...(prazos.logoBgHex && !pasta.clienteLogoBgHex ? { clienteLogoBgHex: `#${prazos.logoBgHex}` } : {}),
      prazosLidosEm: new Date(),
    },
  });
  return prazos;
}
