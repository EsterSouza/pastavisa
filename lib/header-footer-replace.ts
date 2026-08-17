import sharp from "sharp";
import PizZip from "pizzip";
import { relsPathFor, ensureContentTypeDefault } from "./logo-replacer";
import { assertValidDocxBuffer } from "./docx-validator";
import {
  aplicarSubstituicoes,
  hashDocx,
  type Substituicao,
  type SubstituicaoPlanejada,
} from "./docx-replacement-plan";

export type { Substituicao, SubstituicaoPlanejada };
export { hashDocx };

const HEADER_FOOTER_PARTS = [
  "word/header1.xml",
  "word/header2.xml",
  "word/header3.xml",
  "word/footer1.xml",
  "word/footer2.xml",
  "word/footer3.xml",
];

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
const HEADER_MAX_HEIGHT_EMU = 684_000; // ~1,9cm — impede a linha do cabeçalho de crescer

/**
 * Lê todo `<Relationship .../>` de um rels independentemente da ordem dos atributos
 * e devolve a imagem de menor rId — documentos reais, editados à mão ao longo do
 * tempo, nem sempre mantêm `Id`/`Type`/`Target` na ordem que o fluxo principal gera.
 */
function findPartImageReference(relsXml: string): { rId: string; target: string } | null {
  const relationships = Array.from(relsXml.matchAll(/<Relationship\b[^>]*\/>/g)).map((m) => m[0]);
  const images: Array<{ id: number; target: string }> = [];

  for (const rel of relationships) {
    const typeMatch = rel.match(/Type="([^"]*)"/);
    if (!typeMatch || !/\/image$/.test(typeMatch[1])) continue;
    const idMatch = rel.match(/Id="rId(\d+)"/);
    const targetMatch = rel.match(/Target="([^"]+)"/);
    if (!idMatch || !targetMatch) continue;
    images.push({ id: parseInt(idMatch[1], 10), target: targetMatch[1] });
  }

  if (images.length === 0) return null;
  images.sort((a, b) => a.id - b.id);
  return { rId: `rId${images[0].id}`, target: images[0].target };
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
 * Substitui a imagem de logo referenciada por cada cabeçalho/rodapé deste docx,
 * uma parte por vez (e não uma imagem "canônica" compartilhada por todas — documentos
 * finalizados reais podem ter uma imagem diferente por parte, por exemplo um cabeçalho
 * de primeira página referenciando outra coisa enquanto o cabeçalho padrão tem a
 * célula com a logo de fato). Para cada parte, redimensiona o desenho para preencher
 * exatamente a célula que o contém — ampliando de propósito, porque o objetivo é
 * casar com o tamanho pré-definido da célula, não preservar a resolução nativa da
 * foto enviada. Partes cuja imagem não está dentro de uma célula ficam no tamanho
 * original, já que não há caixa contra a qual medir.
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

  for (const partName of HEADER_FOOTER_PARTS) {
    if (!zip.files[partName]) continue;
    const relsPath = relsPathFor(partName);
    if (!zip.files[relsPath]) continue;

    const ref = findPartImageReference(zip.files[relsPath].asText());
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

    const maxWidthEmu = Math.round(cellWidthTwips * TWIP_TO_EMU * HEADER_CELL_INSET);
    const scale = Math.min(maxWidthEmu / naturalWEmu, HEADER_MAX_HEIGHT_EMU / naturalHEmu);
    const targetCx = Math.round(naturalWEmu * scale);
    const targetCy = Math.round(naturalHEmu * scale);

    let resizedXml = partXml;
    resizedXml = resizedXml.replace(/(wp:extent[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`);
    resizedXml = resizedXml.replace(/(wp:extent[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`);
    resizedXml = resizedXml.replace(/(a:ext[^>]*?\scx=")[^"]*(")/g, `$1${targetCx}$2`);
    resizedXml = resizedXml.replace(/(a:ext[^>]*?\scy=")[^"]*(")/g, `$1${targetCy}$2`);
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
