import { createHash } from "crypto";
import PizZip from "pizzip";
import { validateXmlWellFormed } from "./docx-validator";

/**
 * Motor de substituição de texto em .docx já finalizados.
 *
 * Este módulo é a única fonte de verdade tanto para *contar* o que uma rodada de
 * correção faria (preflight) quanto para *aplicar* essa rodada. Contagem e
 * aplicação percorrem exatamente o mesmo código com a flag `aplicar`, para que o
 * número que o operador vê antes nunca divirja do que acontece depois.
 *
 * Garantias estruturais:
 * - só o conteúdo textual dentro de `<w:t>` é reescrito; nenhum elemento é
 *   criado, movido ou removido, então imagens, tabulações, quebras, relações e
 *   propriedades de run (`<w:rPr>`) sobrevivem por construção;
 * - as ocorrências são localizadas sobre o texto original do parágrafo e
 *   aplicadas do fim para o início, de modo que um par não enxergue o resultado
 *   do outro e os deslocamentos anteriores continuem válidos;
 * - cada parte reescrita é validada antes de voltar para o zip.
 */

const HEADER_FOOTER_PARTS = [
  "word/header1.xml",
  "word/header2.xml",
  "word/header3.xml",
  "word/footer1.xml",
  "word/footer2.xml",
  "word/footer3.xml",
];

const BODY_PART = "word/document.xml";

/** Quantos caracteres de cada lado entram no trecho de contexto mostrado ao operador. */
const JANELA_CONTEXTO = 40;

export type EscopoParte = "corpo" | "cabecalho" | "rodape";

export interface Substituicao {
  de: string;
  para: string;
}

export interface OcorrenciaPlanejada {
  escopo: EscopoParte;
  parte: string;
  contexto: string;
}

export interface SubstituicaoPlanejada {
  de: string;
  para: string;
  total: number;
  corpo: number;
  cabecalho: number;
  rodape: number;
  ocorrencias: OcorrenciaPlanejada[];
}

export interface PlanoDeSubstituicao {
  hashOrigem: string;
  totalOcorrencias: number;
  substituicoes: SubstituicaoPlanejada[];
  naoEncontradas: string[];
}

/** SHA-256 do .docx de origem, usado para travar aplicação sobre base divergente. */
export function hashDocx(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Partes de cabeçalho/rodapé que existem como entrada do zip. */
export function listHeaderFooterParts(zip: PizZip): string[] {
  return HEADER_FOOTER_PARTS.filter((name) => !!zip.files[name]);
}

/** Resolve um Id de relacionamento para o seu Target dentro do XML de um `.rels`. */
function resolveRelsTarget(relsXml: string, rId: string): string | null {
  const relationships = Array.from(relsXml.matchAll(/<Relationship\b[^>]*\/>/g)).map((m) => m[0]);
  for (const rel of relationships) {
    const idMatch = rel.match(/Id="([^"]+)"/);
    if (!idMatch || idMatch[1] !== rId) continue;
    const targetMatch = rel.match(/Target="([^"]+)"/);
    return targetMatch ? targetMatch[1] : null;
  }
  return null;
}

/**
 * Quais partes de cabeçalho/rodapé estão de fato ligadas ao documento (referenciadas
 * por um `<w:headerReference>`/`<w:footerReference>` em algum `<w:sectPr>`), e não
 * apenas presentes como entrada do zip. Documentos reais, editados à mão várias
 * vezes, carregam partes órfãs de revisões anteriores — aplicar substituição nelas
 * relataria sucesso enquanto a parte que o Word realmente renderiza fica intacta.
 * Retorna null quando o grafo de referências não pode ser resolvido, para o chamador
 * cair no conjunto de partes meramente existentes.
 */
export function listActiveHeaderFooterParts(zip: PizZip): string[] | null {
  const docFile = zip.files[BODY_PART];
  const relsFile = zip.files["word/_rels/document.xml.rels"];
  if (!docFile || !relsFile) return null;

  let docXml: string;
  let relsXml: string;
  try {
    docXml = docFile.asText();
    relsXml = relsFile.asText();
  } catch {
    return null;
  }

  const sectPrBlocks = Array.from(docXml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)).map((m) => m[0]);
  if (sectPrBlocks.length === 0) return null;

  const rIds = new Set<string>();
  for (const block of sectPrBlocks) {
    const refs = Array.from(block.matchAll(/<w:(?:header|footer)Reference\b[^>]*\/>/g));
    for (const ref of refs) {
      const idMatch = ref[0].match(/r:id="([^"]+)"/);
      if (idMatch) rIds.add(idMatch[1]);
    }
  }
  if (rIds.size === 0) return null;

  const parts = new Set<string>();
  rIds.forEach((rId) => {
    const target = resolveRelsTarget(relsXml, rId);
    if (!target) return;
    const zipPath = target.startsWith("word/") ? target : `word/${target}`;
    if (zip.files[zipPath]) parts.add(zipPath);
  });

  return parts.size > 0 ? Array.from(parts) : null;
}

/**
 * Conjunto de partes onde a substituição de texto atua: cabeçalhos e rodapés
 * ativos mais o corpo. O corpo entra sempre — é a única parte que nunca é ambígua
 * quanto a ser "a" cópia vigente.
 */
export function resolveTextParts(zip: PizZip): string[] {
  const cabecalhosRodapes = listActiveHeaderFooterParts(zip) ?? listHeaderFooterParts(zip);
  return zip.files[BODY_PART] ? [...cabecalhosRodapes, BODY_PART] : cabecalhosRodapes;
}

export function escopoDaParte(parte: string): EscopoParte {
  if (parte === BODY_PART) return "corpo";
  return /\/footer\d*\.xml$/i.test(parte) ? "rodape" : "cabecalho";
}

function normalizeSelfClosingParagraphs(xml: string): string {
  // <w:p ... /> precisa virar <w:p ...></w:p> antes de rodar um regex não-guloso
  // <w:p>...</w:p>, senão ele engole a estrutura de tabela que vem depois de um
  // parágrafo vazio auto-fechado.
  return xml.replace(/<w:p(?=[\s>])([^>]*)\/>/g, (_, attrs) => `<w:p${attrs}></w:p>`);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXmlEntities(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Monta um regex que casa `de` literalmente, exceto pelos espaços: qualquer
 * sequência de espaço/tab/quebra/espaço-inseparável em `de` casa com qualquer
 * sequência de espaços no documento — inclusive nenhuma. Continua sendo casamento
 * exato de conteúdo: só tolera o ruído de espaçamento que o Word introduz, e nunca
 * adivinha outra redação. Não existe regex livre vindo do operador.
 */
export function buildFlexibleWhitespacePattern(de: string): RegExp {
  const escaped = escapeRegExp(de);
  // "*" e não "+": o texto colado pode ter espaços em volta da pontuação
  // ("CNPJ : 123") que simplesmente não existem no texto do run ("CNPJ: 123").
  const flexible = escaped.replace(/[ \t\n\r ]+/g, "\\s*");
  return new RegExp(flexible, "g");
}

interface NoDeTexto {
  /** Índice de `<w:t` no XML do parágrafo. */
  abre: number;
  /** Índice logo após `</w:t>`. */
  fecha: number;
  attrs: string;
  texto: string;
  /** Deslocamento deste nó no texto concatenado do parágrafo. */
  charStart: number;
  alterado: boolean;
}

/**
 * Mapeia cada caractere visível do parágrafo para o `<w:t>` que o contém.
 * Só nós `<w:t>` entram no mapa: `<w:tab/>`, `<w:br/>`, desenhos e demais
 * elementos ficam de fora e por isso jamais são tocados. Um par cujo texto
 * atravessa uma tabulação ainda casa, porque o padrão tolerante trata espaço
 * como "zero ou mais".
 *
 * Limite conhecido: quando o par atravessa uma tabulação, o texto novo entra
 * inteiro antes dela e a tabulação passa a sobrar no fim do trecho, o que pode
 * desalinhar um layout "rótulo <tab> valor". O documento continua íntegro e o
 * texto correto, e nenhum elemento é perdido; casar par com rótulo e valor
 * separadamente evita o efeito.
 */
function mapearNosDeTexto(paragrafoXml: string): NoDeTexto[] {
  const nos: NoDeTexto[] = [];
  const regex = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  let charStart = 0;

  while ((match = regex.exec(paragrafoXml)) !== null) {
    const texto = decodeXmlEntities(match[2] ?? "");
    nos.push({
      abre: match.index,
      fecha: match.index + match[0].length,
      attrs: match[1] ?? "",
      texto,
      charStart,
      alterado: false,
    });
    charStart += texto.length;
  }

  return nos;
}

function atributosComEspacoPreservado(attrs: string, texto: string): string {
  if (/\bxml:space\s*=/.test(attrs)) return attrs;
  if (texto === texto.trim()) return attrs;
  return `${attrs} xml:space="preserve"`;
}

function contextoDe(plain: string, inicio: number, fim: number): string {
  const antes = plain.slice(Math.max(0, inicio - JANELA_CONTEXTO), inicio);
  const trecho = plain.slice(inicio, fim);
  const depois = plain.slice(fim, fim + JANELA_CONTEXTO);
  const prefixo = inicio > JANELA_CONTEXTO ? "…" : "";
  const sufixo = fim + JANELA_CONTEXTO < plain.length ? "…" : "";
  return `${prefixo}${antes}«${trecho}»${depois}${sufixo}`.replace(/\s+/g, " ").trim();
}

interface OcorrenciaBruta {
  indice: number;
  inicio: number;
  fim: number;
}

/**
 * Localiza e (opcionalmente) aplica as substituições de um parágrafo.
 *
 * Todas as ocorrências são localizadas sobre o texto original, antes de qualquer
 * escrita, então o resultado de um par nunca é reprocessado por outro. Casamentos
 * sobrepostos são resolvidos pela ordem dos pares: o primeiro par a reivindicar
 * um trecho fica com ele, e o concorrente não é contado nem aplicado.
 */
function processarParagrafo(
  paragrafoXml: string,
  subs: Substituicao[],
  padroes: RegExp[],
  aplicar: boolean
): { xml: string; ocorrencias: Array<{ indice: number; contexto: string }> } {
  const nos = mapearNosDeTexto(paragrafoXml);
  if (nos.length === 0) return { xml: paragrafoXml, ocorrencias: [] };

  const plain = nos.map((n) => n.texto).join("");
  if (!plain) return { xml: paragrafoXml, ocorrencias: [] };

  const aceitas: OcorrenciaBruta[] = [];
  subs.forEach((_, indice) => {
    for (const match of Array.from(plain.matchAll(padroes[indice]))) {
      if (!match[0]) continue; // padrão degenerado: nunca consome caractere
      const inicio = match.index ?? 0;
      const fim = inicio + match[0].length;
      const sobrepoe = aceitas.some((a) => inicio < a.fim && fim > a.inicio);
      if (sobrepoe) continue;
      aceitas.push({ indice, inicio, fim });
    }
  });

  if (aceitas.length === 0) return { xml: paragrafoXml, ocorrencias: [] };

  const ocorrencias = aceitas
    .slice()
    .sort((a, b) => a.inicio - b.inicio)
    .map((o) => ({ indice: o.indice, contexto: contextoDe(plain, o.inicio, o.fim) }));

  if (!aplicar) return { xml: paragrafoXml, ocorrencias };

  // Do fim para o início: assim os deslocamentos das ocorrências anteriores
  // continuam válidos mesmo depois de o texto dos nós mudar.
  for (const ocorrencia of aceitas.slice().sort((a, b) => b.inicio - a.inicio)) {
    const { inicio, fim } = ocorrencia;
    const para = subs[ocorrencia.indice].para;
    const tocados = nos.filter((n) => n.charStart < fim && n.charStart + n.texto.length > inicio);
    if (tocados.length === 0) continue;

    tocados.forEach((no, posicao) => {
      const inicioLocal = Math.max(0, inicio - no.charStart);
      const fimLocal = Math.min(no.texto.length, fim - no.charStart);
      const prefixo = no.texto.slice(0, inicioLocal);
      const sufixo = no.texto.slice(fimLocal);
      // O texto novo entra inteiro no primeiro nó tocado, que mantém o seu run e
      // as suas propriedades. Os demais perdem apenas o trecho casado; o run, o
      // `<w:rPr>` e qualquer elemento irmão permanecem no lugar.
      no.texto = posicao === 0 ? `${prefixo}${para}${sufixo}` : `${prefixo}${sufixo}`;
      no.alterado = true;
    });
  }

  let xml = paragrafoXml;
  for (let i = nos.length - 1; i >= 0; i--) {
    const no = nos[i];
    if (!no.alterado) continue;
    const attrs = atributosComEspacoPreservado(no.attrs, no.texto);
    const novoNo = `<w:t${attrs}>${encodeXmlEntities(no.texto)}</w:t>`;
    xml = xml.slice(0, no.abre) + novoNo + xml.slice(no.fecha);
  }

  return { xml, ocorrencias };
}

function substituicoesValidas(subs: Substituicao[]): Substituicao[] {
  return subs.filter((s) => s.de && s.de.trim().length > 0);
}

function planoVazio(subs: Substituicao[]): SubstituicaoPlanejada[] {
  return subs.map((s) => ({
    de: s.de,
    para: s.para,
    total: 0,
    corpo: 0,
    cabecalho: 0,
    rodape: 0,
    ocorrencias: [],
  }));
}

/**
 * Percorre as partes de texto contando — e, quando `aplicar` é verdadeiro,
 * executando — as substituições. Cada parte reescrita é validada antes de voltar
 * para o zip, e a falha nomeia a parte responsável.
 */
function percorrerPartes(
  zip: PizZip,
  partes: string[],
  subs: Substituicao[],
  aplicar: boolean
): SubstituicaoPlanejada[] {
  const planejadas = planoVazio(subs);
  if (subs.length === 0) return planejadas;

  const padroes = subs.map((s) => buildFlexibleWhitespacePattern(s.de));

  for (const parte of partes) {
    const arquivo = zip.files[parte];
    if (!arquivo) continue;

    let xml: string;
    try {
      xml = normalizeSelfClosingParagraphs(arquivo.asText());
    } catch (err) {
      throw new Error(
        `Nao foi possivel ler ${parte} do documento: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
    }

    const escopo = escopoDaParte(parte);
    let parteAlterada = false;

    const novoXml = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragrafo) => {
      const resultado = processarParagrafo(paragrafo, subs, padroes, aplicar);
      for (const ocorrencia of resultado.ocorrencias) {
        const alvo = planejadas[ocorrencia.indice];
        alvo.total += 1;
        alvo[escopo] += 1;
        alvo.ocorrencias.push({ escopo, parte, contexto: ocorrencia.contexto });
      }
      if (resultado.xml !== paragrafo) parteAlterada = true;
      return resultado.xml;
    });

    if (!aplicar || !parteAlterada) continue;

    const erro = validateXmlWellFormed(novoXml);
    if (erro) {
      throw new Error(`Substituicao invalidaria ${parte}: ${erro}`);
    }
    zip.file(parte, novoXml);
  }

  return planejadas;
}

/** Conta o impacto de uma rodada de correção sem alterar o documento. */
export function planejarSubstituicoes(buffer: Buffer, subs: Substituicao[]): PlanoDeSubstituicao {
  const validas = substituicoesValidas(subs);
  const zip = new PizZip(buffer);
  const planejadas = percorrerPartes(zip, resolveTextParts(zip), validas, false);

  return {
    hashOrigem: hashDocx(buffer),
    totalOcorrencias: planejadas.reduce((soma, s) => soma + s.total, 0),
    substituicoes: planejadas,
    naoEncontradas: planejadas.filter((s) => s.total === 0).map((s) => s.de),
  };
}

/** Aplica as substituições no zip recebido e devolve a contagem do que foi feito. */
export function aplicarSubstituicoes(zip: PizZip, subs: Substituicao[]): SubstituicaoPlanejada[] {
  return percorrerPartes(zip, resolveTextParts(zip), substituicoesValidas(subs), true);
}
