// Rasteriza cada página de um PDF em PNG, para conferência visual do resultado.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PDF = process.argv[2];
const SAIDA = process.argv[3];
const base64 = readFileSync(PDF).toString("base64");

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1000, height: 1400 } });

await pagina.setContent(`<!doctype html><html><body style="margin:0"><div id="raiz"></div>
<script src="https://unpkg.com/pdfjs-dist@4.6.82/build/pdf.min.mjs" type="module"></script></body></html>`);

const total = await pagina.evaluate(async (dados) => {
  const pdfjs = await import("https://unpkg.com/pdfjs-dist@4.6.82/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs";
  const bytes = Uint8Array.from(atob(dados), (c) => c.charCodeAt(0));
  const documento = await pdfjs.getDocument({ data: bytes }).promise;
  const raiz = document.getElementById("raiz");

  for (let numero = 1; numero <= documento.numPages; numero += 1) {
    const pagina = await documento.getPage(numero);
    const viewport = pagina.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    canvas.id = `pagina-${numero}`;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    raiz.appendChild(canvas);
    await pagina.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  }

  return documento.numPages;
}, base64);

for (let numero = 1; numero <= total; numero += 1) {
  await pagina.locator(`#pagina-${numero}`).screenshot({ path: join(SAIDA, `pdf-${numero}.png`) });
}

console.log(`${total} páginas rasterizadas`);
await navegador.close();
