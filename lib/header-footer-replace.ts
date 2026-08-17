import sharp from "sharp";
import PizZip from "pizzip";
import { relsPathFor, ensureContentTypeDefault } from "./logo-replacer";
import { assertValidDocxBuffer } from "./docx-validator";
import {
  aplicarSubstituicoes,
  hashDocx,
  listActiveHeaderFooterParts,
  listHeaderFooterParts,
  type Substituicao,
  type SubstituicaoPlanejada,
} from "./docx-replacement-plan";

export type { Substituicao, SubstituicaoPlanejada };
export { hashDocx };

export interface AplicarBatchResult {
  buffer: Buffer;
  aplicadas: string[];
  naoEncontradas: string[];
  logoSubstituida: boolean;
  /** Contagem por par e por escopo do que foi efetivamente aplicado. */
  contagens: SubstituicaoPlanejada[];
}

const TWIP_TO_EMU = 635;
const HEADER_CELL_INSET = 0.92; // ~8% de recuo das bordas da célula, igual ao fluxo principal
// Teto de altura de último recurso, usado só quando a linha do cabeçalho não
// declara altura própria. Conservador de propósito: sem geometria declarada, deixar
// a logo preencher a largura faria a faixa do cabeçalho crescer sem limite (uma logo
// quadrada numa célula de 8 cm viraria um cabeçalho de 8 cm de altura).
const HEADER_MAX_HEIGHT_EMU = 684_000; // ~1,9 cm

/** Um rId de imagem está de fato desenhado nesta parte (e não só declarado no rels)? */
function isImageEmbedded(partXml: string, rId: string): boolean {
  // O sufixo `"` fecha o valor do atributo, então rId5 não casa com rId50.
  return new RegExp(`r:(?:embed|link)="${rId}"`).test(partXml);
}

/**
 * Escolhe, dentro de uma parte, qual imagem é a logo.
 *
 * Lê todo `<Relationship .../>` independentemente da ordem dos atributos, porque
 * documentos reais, editados à mão ao longo do tempo, nem sempre mantêm
 * `Id`/`Type`/`Target` na ordem que o fluxo principal gera.
 *
 * A escolha é feita em duas peneiras, e não pelo menor rId direto:
 *
 * 1. Só entram imagens efetivamente desenhadas nesta parte. Um rels pode declarar
 *    imagens que sobraram de revisões anteriores e que nenhum `<a:blip>` referencia
 *    — trocar os bytes dessas não muda nada no que o Word renderiza e, pior, o
 *    arquivo de mídia pode ser compartilhado com outra parte, onde a troca aparece
 *    como imagem errada substituída.
 * 2. Entre as desenhadas, tem prioridade a que está dentro de uma célula de tabela
 *    com largura declarada — o formato do slot de logo em todo este projeto. Numa
 *    parte que tem uma foto no corpo do cabeçalho e a logo na célula, o menor rId
 *    podia ser a foto.
 *
 * O menor rId continua sendo o desempate, agora só entre candidatas do mesmo grupo.
 */
function findPartImageReference(
  relsXml: string,
  partXml: string
): { rId: string; target: string } | null {
  const relationships = Array.from(relsXml.matchAll(/<Relationship\b[^>]*\/>/g)).map((m) => m[0]);
  const images: Array<{ id: number; rId: string; target: string }> = [];

  for (const rel of relationships) {
    const typeMatch = rel.match(/Type="([^"]*)"/);
    if (!typeMatch || !/\/image$/.test(typeMatch[1])) continue;
    const idMatch = rel.match(/Id="rId(\d+)"/);
    const targetMatch = rel.match(/Target="([^"]+)"/);
    if (!idMatch || !targetMatch) continue;
    const rId = `rId${idMatch[1]}`;
    if (!isImageEmbedded(partXml, rId)) continue;
    images.push({ id: parseInt(idMatch[1], 10), rId, target: targetMatch[1] });
  }

  if (images.length === 0) return null;
  images.sort((a, b) => a.id - b.id);

  const emCelula = images.filter((img) => findImageCellWidthTwips(partXml, img.rId) !== null);
  const escolhida = emCelula.length > 0 ? emCelula[0] : images[0];
  return { rId: escolhida.rId, target: escolhida.target };
}

/** Reescreve o atributo `Target` do `<Relationship>` com o rId informado. */
function retargetRelationship(relsXml: string, rId: string, newTarget: string): string {
  return relsXml.replace(/<Relationship\b[^>]*\/>/g, (rel) => {
    const idMatch = rel.match(/Id="([^"]+)"/);
    if (!idMatch || idMatch[1] !== rId) return rel;
    return rel.replace(/Target="[^"]*"/, `Target="${newTarget}"`);
  });
}

/** Largura (em twips) da célula de tabela cujo desenho embute `rId`. */
function findImageCellWidthTwips(xml: string, rId: string): number | null {
  const cells = xml.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || [];
  for (const cell of cells) {
    if (cell.includes(`r:embed="${rId}"`)) {
      const match = cell.match(/<w:tcW\s+w:w="(\d+)"/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}

/**
 * Teto de altura (em twips) imposto pela linha de tabela que contém o desenho de
 * `rId` — e **somente** quando a linha declara `w:hRule="exact"`.
 *
 * `<w:trHeight>` é ambíguo por si só: com `hRule="exact"` o valor é a altura fixa
 * da linha, e o Word corta o que passar dela, então sobra como teto legítimo. Com
 * `hRule="atLeast"` — que é o **padrão quando o atributo está ausente** — o valor é
 * a altura *mínima*, e a linha cresce com o conteúdo: usá-lo como teto encolheria a
 * logo em vez de ajustá-la. Nos documentos reais desta consultoria a linha declara
 * `<w:trHeight w:val="419"/>` sem `hRule`, ou seja 0,74 cm de mínimo, enquanto a
 * logo vigente tem 1,90 cm de altura — tratar 419 como máximo reduziria a logo a
 * um terço do tamanho atual.
 *
 * `null` quando não há teto declarado, caso em que o chamador usa o conservador.
 *
 * Assume tabela de cabeçalho simples, sem tabela aninhada — a mesma premissa que
 * `findImageCellWidthTwips` já fazia.
 */
function findImageRowHeightCapTwips(xml: string, rId: string): number | null {
  const rows = xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
  for (const row of rows) {
    if (!row.includes(`r:embed="${rId}"`)) continue;
    const trHeight = row.match(/<w:trHeight\b[^>]*\/>/);
    if (!trHeight) return null;
    if (!/\bw:hRule="exact"/.test(trHeight[0])) return null;
    const valor = trHeight[0].match(/\sw:val="(\d+)"/);
    return valor ? parseInt(valor[1], 10) : null;
  }
  return null;
}

/**
 * Substitui a imagem de logo referenciada por cada cabeçalho/rodapé deste docx,
 * uma parte por vez (e não uma imagem "canônica" compartilhada por todas — documentos
 * finalizados reais podem ter uma imagem diferente por parte, por exemplo um cabeçalho
 * de primeira página referenciando outra coisa enquanto o cabeçalho padrão tem a
 * célula com a logo de fato). Para cada parte, redimensiona o desenho para preencher
 * exatamente a célula que o contém — ampliando de propósito, porque o objetivo é
 * casar com o tamanho pré-definido da célula, não preservar a resolução nativa da
 * foto enviada. Partes cuja imagem não está dentro de uma célula ficam no tamanho
 * original, já que não há caixa contra a qual medir.
 *
 * Só percorre as partes que o corpo realmente referencia via `<w:sectPr>`, pelo mesmo
 * motivo que a substituição de texto: partes órfãs de revisões anteriores continuam
 * dentro do zip, e mexer nelas relata sucesso sem alterar o que o Word renderiza —
 * podendo ainda atingir um arquivo de mídia compartilhado com a parte vigente. Quando
 * o grafo de referências não pode ser resolvido, cai para as partes existentes, que é
 * o comportamento anterior.
 */
export async function replaceLogoInHeadersAndFooters(
  zip: PizZip,
  logoBuffer: Buffer
): Promise<{ substituida: boolean }> {
  let naturalW: number;
  let naturalH: number;
  try {
    const meta = await sharp(logoBuffer).metadata();
    naturalW = meta.width ?? 200;
    naturalH = meta.height ?? 100;
  } catch {
    return { substituida: false };
  }
  const naturalWEmu = naturalW * 9144;
  const naturalHEmu = naturalH * 9144;

  let substituida = false;
  const partes = listActiveHeaderFooterParts(zip) ?? listHeaderFooterParts(zip);

  for (const partName of partes) {
    if (!zip.files[partName]) continue;
    const relsPath = relsPathFor(partName);
    if (!zip.files[relsPath]) continue;

    const ref = findPartImageReference(zip.files[relsPath].asText(), zip.files[partName].asText());
    if (!ref) continue;

    const zipPath = ref.target.startsWith("media/") ? `word/${ref.target}` : ref.target;
    if (!zip.files[zipPath]) continue;

    // Sempre grava PNG, independentemente do formato original do slot. Logos são
    // frequentemente PNGs transparentes, e converter para JPEG (sem canal alfa)
    // força o sharp a achatar os pixels transparentes sobre um fundo opaco — que
    // por padrão é preto, e foi assim que uma logo transparente virou uma com
    // fundo preto. Se o slot era .jpeg/.jpg, o relacionamento é reapontado para um
    // arquivo .png de mesmo nome, em vez de enfiar bytes PNG num arquivo que o
    // pacote continua declarando como JPEG.
    const isPngSlot = zipPath.toLowerCase().endsWith(".png");
    const newZipPath = isPngSlot ? zipPath : zipPath.replace(/\.[^./]+$/, ".png");
    try {
      const converted = await sharp(logoBuffer).png().toBuffer();
      zip.file(newZipPath, converted, { binary: true });
      ensureContentTypeDefault(zip, "png");
      if (newZipPath !== zipPath) {
        const newTarget = ref.target.replace(/\.[^./]+$/, ".png");
        zip.file(relsPath, retargetRelationship(zip.files[relsPath].asText(), ref.rId, newTarget));
      }
      substituida = true;
    } catch (err) {
      console.error(`[header-footer-replace] Falha ao substituir ${zipPath}:`, err);
      continue;
    }

    const partXml = zip.files[partName].asText();
    const cellWidthTwips = findImageCellWidthTwips(partXml, ref.rId);
    if (!cellWidthTwips) continue; // sem célula em volta da imagem — não mexe no tamanho

    // A largura da célula é um limite duro: passar dela obriga o Word a alargar a
    // célula, e com ela a tabela do cabeçalho.
    const maxWidthEmu = Math.round(cellWidthTwips * TWIP_TO_EMU * HEADER_CELL_INSET);
    // A altura vem da linha só quando ela impõe um teto de verdade (`hRule="exact"`).
    // Caso contrário vale o teto conservador: linha `atLeast` cresce com o conteúdo
    // e não diz nada sobre o máximo.
    const rowHeightCapTwips = findImageRowHeightCapTwips(partXml, ref.rId);
    const maxHeightEmu = rowHeightCapTwips
      ? Math.round(rowHeightCapTwips * TWIP_TO_EMU * HEADER_CELL_INSET)
      : HEADER_MAX_HEIGHT_EMU;
    const scale = Math.min(maxWidthEmu / naturalWEmu, maxHeightEmu / naturalHEmu);
    const targetCx = Math.round(naturalWEmu * scale);
    const targetCy = Math.round(naturalHEmu * scale);

    // Só o desenho que embute a logo é redimensionado. Aplicar os regexes de
    // extent na parte inteira também esticava qualquer outra imagem do cabeçalho
    // para a caixa da logo — a mídia certa era preservada, mas a foto ao lado saía
    // distorcida. `<w:drawing>` não aninha, então o recorte não-guloso é seguro;
    // desenhos em VML antigo, que não têm esse invólucro, ficam sem redimensionar,
    // o que é preferível a redimensionar o alvo errado.
    const resizedXml = partXml.replace(/<w:drawing[\s\S]*?<\/w:drawing>/g, (bloco) => {
      if (!bloco.includes(`r:embed="${ref.rId}"`)) return bloco;
      return bloco
        .replace(/(wp:extent[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`)
        .replace(/(wp:extent[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`)
        .replace(/(a:ext[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`)
        .replace(/(a:ext[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`);
    });
    zip.file(partName, resizedXml);
  }

  return { substituida };
}

/**
 * Orquestra uma rodada de correção sobre um .docx já finalizado: troca a logo se
 * houver, aplica as substituições de texto em cabeçalhos, rodapés e corpo, valida
 * o resultado e devolve o novo buffer com o relatório por par.
 *
 * A contagem devolvida vem do mesmo motor que fez a escrita, então ela descreve o
 * que realmente aconteceu — não uma estimativa paralela.
 */
export async function applyBatchChanges(
  buffer: Buffer,
  opts: { logoBuffer?: Buffer; substituicoes?: Substituicao[] }
): Promise<AplicarBatchResult> {
  const zip = new PizZip(buffer);

  let logoSubstituida = false;
  if (opts.logoBuffer) {
    const result = await replaceLogoInHeadersAndFooters(zip, opts.logoBuffer);
    logoSubstituida = result.substituida;
  }

  let contagens: SubstituicaoPlanejada[] = [];
  if (opts.substituicoes && opts.substituicoes.length > 0) {
    contagens = aplicarSubstituicoes(zip, opts.substituicoes);
  }

  const outputBuffer = zip.generate({ type: "nodebuffer" }) as Buffer;
  assertValidDocxBuffer(outputBuffer);

  return {
    buffer: outputBuffer,
    aplicadas: contagens.filter((s) => s.total > 0).map((s) => s.de),
    naoEncontradas: contagens.filter((s) => s.total === 0).map((s) => s.de),
    logoSubstituida,
    contagens,
  };
}
