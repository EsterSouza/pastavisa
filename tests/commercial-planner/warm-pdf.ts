import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { loadBrandAssets } from "@/lib/commercial-planner/brand-assets";
import { extractPdfTextFromBuffer } from "@/lib/extractor";

/**
 * Aquece o pipeline de PDF antes do primeiro `it`.
 *
 * `extractPdfTextFromBuffer` carrega o pdf-parse (pdf.js) por `require` preguiçoso,
 * e embutir as fontes da marca inicializa o fontkit. Juntos são ~0,9 s numa máquina
 * ociosa e ~2,7 s quando a suíte inteira disputa CPU — custo fixo de carga de módulo,
 * não do que os testes verificam. Sem isto ele cai no orçamento do primeiro `it`, que
 * encostava nos 5 s de `testTimeout` e estourava de forma intermitente.
 *
 * Use sempre com o `WARMUP_TIMEOUT_MS` abaixo: o `hookTimeout` padrão de 10 s dá
 * pouca folga sobre os ~3 s medidos aqui numa máquina mais lenta.
 */
export const WARMUP_TIMEOUT_MS = 30_000;

export async function warmPdfPipeline(): Promise<void> {
  const brand = await loadBrandAssets();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  if (brand.body) await doc.embedFont(brand.body, { subset: true });
  doc.addPage();
  await extractPdfTextFromBuffer(Buffer.from(await doc.save()));
}
