import { beforeAll, describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { extractPdfTextFromBuffer } from "@/lib/extractor";
import { loadBrandAssets } from "@/lib/commercial-planner/brand-assets";
import { calculatePlannerPrice, PLANNER_FORMATS } from "@/lib/commercial-planner/pricing";
import { OFFICIAL_CAVEAT, renderPlannerPdf, WATERMARK_TEXT } from "@/lib/commercial-planner/render-pdf";
import {
  ACADEMIC_REFERENCES_NOTE,
  AUTHORSHIP_NOTE,
  LOCAL_REFERENCES_NOTE,
  OUT_OF_FOLDER_NOTE,
  TECHNICAL_CRITERIA_NOTE,
} from "@/lib/commercial-planner/references";
import type { PlannerPdfData } from "@/lib/commercial-planner/render-pdf";
import { warmPdfPipeline, WARMUP_TIMEOUT_MS } from "./warm-pdf";

function data(overrides: Partial<PlannerPdfData> = {}): PlannerPdfData {
  return {
    cliente: "Clínica Estética Aurora",
    municipio: "Belo Horizonte",
    uf: "MG",
    emitidoEm: new Date("2026-08-17T15:00:00.000Z"),
    incluidos: ["Limpeza de pele", "Microagulhamento"],
    retirados: ["Peeling químico"],
    documentos: [
      { nome: "POP - Limpeza de pele", tipo: "POP" },
      { nome: "TCLE - Procedimentos estéticos faciais", tipo: "TCLE" },
    ],
    preco: calculatePlannerPrice(2, "colorida"),
    comparativo: PLANNER_FORMATS.map((formato) => calculatePlannerPrice(2, formato)),
    prazo: { diasUteis: 15, sujeitoConfirmacaoTecnica: false },
    alertas: ["Confirme se “Jato de plasma” é uma técnica realizada no estabelecimento."],
    ...overrides,
  };
}

async function text(overrides: Partial<PlannerPdfData> = {}) {
  const bytes = await renderPlannerPdf(data(overrides));
  const buffer = Buffer.from(bytes);
  return { buffer, conteudo: await extractPdfTextFromBuffer(buffer) };
}

describe("PDF do planejamento comercial", () => {
  beforeAll(warmPdfPipeline, WARMUP_TIMEOUT_MS);

  it("gera um PDF A4 válido e marcado como provisório", async () => {
    const { buffer, conteudo } = await text();

    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-6).toString("latin1")).toContain("%%EOF");
    expect(conteudo).toContain(WATERMARK_TEXT);
    expect(conteudo).toContain("Pré-planejamento comercial");
    expect(conteudo.replace(/\s+/g, " ")).toContain(OFFICIAL_CAVEAT.replace(/\s+/g, " "));
  });

  it("traz cliente, data, incluídos, retirados, documentos, contagem, preços, prazo e alertas", async () => {
    const { conteudo } = await text();
    const plano = conteudo.replace(/\s+/g, " ");

    expect(plano).toContain("Clínica Estética Aurora");
    expect(plano).toContain("Belo Horizonte / MG");
    expect(plano).toContain("Emitido em 17/08/2026");
    expect(plano).toContain("Limpeza de pele");
    expect(plano).toContain("Microagulhamento");
    expect(plano).toContain("Peeling químico");
    expect(plano).toContain("POP - Limpeza de pele");
    expect(plano).toContain("TCLE - Procedimentos estéticos faciais");
    expect(plano).toContain("Contagem: 2 documento(s) para 2 procedimento(s)");
    expect(plano).toContain("R$ 957,00");
    expect(plano).toContain("R$ 597,00");
    expect(plano).toContain("R$ 797,00");
    expect(plano).toContain("15 dias úteis");
    expect(plano).toContain("é uma técnica realizada no estabelecimento");
  });

  it("mostra o adicional e a ressalva de prazo acima de 100 procedimentos", async () => {
    const { conteudo } = await text({
      incluidos: Array.from({ length: 101 }, (_, index) => `Técnica ${index + 1}`),
      retirados: [],
      preco: calculatePlannerPrice(101, "digital"),
      comparativo: PLANNER_FORMATS.map((formato) => calculatePlannerPrice(101, formato)),
      prazo: { diasUteis: 15, sujeitoConfirmacaoTecnica: true },
    });
    const plano = conteudo.replace(/\s+/g, " ");

    expect(plano).toContain("R$ 100,00");
    expect(plano).toContain("R$ 697,00");
    expect(plano).toContain("sujeito à confirmação técnica");
    expect(plano).toMatch(/Página 1 de [2-9]/);
  });

  it("não vaza catálogo, ID, cobertura nem mecanismo técnico", async () => {
    // O PDF recebe o documento já com o nome público; quem faz essa conversão é a
    // saída pública, coberta por tests/commercial-planner/document-names.test.ts.
    const { conteudo } = await text({
      documentos: [{ nome: "POP — Microagulhamento", tipo: "POP" }],
    });

    for (const proibido of [
      /cat[aá]logo/i,
      /prompt/i,
      /score/i,
      /pontua[cç][aã]o/i,
      /cobertura/i,
      /\bmodelo de IA\b/i,
      /\bID\b/,
      /catalogId/i,
      /template/i,
      /intelig[eê]ncia artificial/i,
      /\bgerad[oa]s?\b/i,
      /banco de dados/i,
    ]) {
      expect(conteudo).not.toMatch(proibido);
    }
  });

  it("cita as referências federais de base e o alcance das normas locais", async () => {
    const { conteudo } = await text();
    const plano = conteudo.replace(/\s+/g, " ");

    expect(plano).toContain("Referências normativas de base");
    expect(plano).toContain("Estatuto dos Direitos do Paciente");
    expect(plano).toContain("RDC Anvisa nº 63/2011");
    expect(plano).toContain("RDC Anvisa nº 222/2018");
    expect(plano).toContain("NR-32");
    expect(plano).toContain(LOCAL_REFERENCES_NOTE.replace(/\s+/g, " "));
    expect(plano).toContain(ACADEMIC_REFERENCES_NOTE.replace(/\s+/g, " "));
  });

  it("diz quem elabora, o que a pasta não traz e o critério técnico da especialista", async () => {
    const { conteudo } = await text();
    const plano = conteudo.replace(/\s+/g, " ");

    expect(plano).toContain(AUTHORSHIP_NOTE.replace(/\s+/g, " "));
    expect(plano).toContain(OUT_OF_FOLDER_NOTE.replace(/\s+/g, " "));
    expect(plano).toContain(TECHNICAL_CRITERIA_NOTE.replace(/\s+/g, " "));
  });
  it("não quebra com caractere fora da fonte nem sem os ativos de marca", async () => {
    const bytes = await renderPlannerPdf({ ...data(), cliente: "Clínica 中文 — Ação" }, {});
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("incorpora as famílias do manual de marca, e não a fallback de escritório", async () => {
    const { buffer } = await text();
    const carregado = await PDFDocument.load(buffer);
    const familias = carregado.context
      .enumerateIndirectObjects()
      .map(([, objeto]) => (objeto instanceof PDFDict ? objeto.get(PDFName.of("BaseFont")) : undefined))
      .filter(Boolean)
      .map(String)
      .join(" ");

    expect(familias).toMatch(/Sora/);
    expect(familias).toMatch(/SourceSans3/);
    expect(familias).not.toMatch(/Helvetica/);
  });

  it("encontra a logo e as duas famílias em disco", async () => {
    const assets = await loadBrandAssets();
    expect(Object.keys(assets).sort()).toEqual(["body", "bodyStrong", "display", "displayStrong", "logo"]);
  });
});
