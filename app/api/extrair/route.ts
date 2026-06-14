import { NextRequest, NextResponse } from "next/server";
import { extractDocxTextFromBuffer, extractPdfTextFromBuffer } from "@/lib/extractor";
import { extractClienteData, type PdfInput } from "@/lib/ai";
import { associarLegislacoesDoDocumento } from "@/lib/legislation-matcher";
import { detectarReferenciasNaoCadastradas } from "@/lib/reference-extractor";
import { prisma } from "@/lib/prisma";
import {
  isManagedStorageReference,
  readStorageBuffer,
  saveStorageBuffer,
  storageDriver,
} from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_NATIVE_PDF_BYTES = 3 * 1024 * 1024;
const MIN_EXTRACTED_PDF_TEXT_CHARS = 200;

interface StoredUploadRequest {
  pdfPath?: string;
  docxPath?: string;
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = Date.now().toString();
    let pdfBuffer: Buffer;
    let docxBuffer: Buffer;
    let pdfPath: string;
    let docxPath: string;

    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = (await req.json()) as StoredUploadRequest;
      if (
        storageDriver() !== "supabase" ||
        !isManagedStorageReference(body.pdfPath, "uploads") ||
        !isManagedStorageReference(body.docxPath, "uploads")
      ) {
        return NextResponse.json({ error: "Referencias de upload invalidas" }, { status: 400 });
      }

      pdfPath = body.pdfPath!;
      docxPath = body.docxPath!;
      [pdfBuffer, docxBuffer] = await Promise.all([
        readStorageBuffer(pdfPath),
        readStorageBuffer(docxPath),
      ]);
    } else {
      const formData = await req.formData();
      const pdfFile = formData.get("formsPdf") as File | null;
      const docxFile = formData.get("documentosElaboracao") as File | null;

      if (!pdfFile || !docxFile) {
        return NextResponse.json({ error: "Arquivos obrigatórios ausentes" }, { status: 400 });
      }

      const pdfFileName = `${sessionId}_forms.pdf`;
      const docxFileName = `${sessionId}_elaboracao.docx`;
      pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
      docxBuffer = Buffer.from(await docxFile.arrayBuffer());
      pdfPath = await saveStorageBuffer("uploads", pdfFileName, pdfBuffer, "application/pdf");
      docxPath = await saveStorageBuffer(
        "uploads",
        docxFileName,
        docxBuffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    }

    const [rawPdfText, elaboracaoText] = await Promise.all([
      extractPdfTextFromBuffer(pdfBuffer).catch((err) => {
        console.warn("[extrair] pdf-parse falhou; avaliando fallback nativo:", err);
        return "";
      }),
      extractDocxTextFromBuffer(docxBuffer),
    ]);

    console.log(`[extrair] docx extraído: ${elaboracaoText.length} chars`);
    console.log(`[extrair] pdf: ${pdfBuffer.length} bytes, texto extraído: ${rawPdfText.length} chars`);

    const pdfText = rawPdfText.trim();
    let pdfInput: PdfInput;
    if (pdfText.length >= MIN_EXTRACTED_PDF_TEXT_CHARS) {
      pdfInput = { type: "pdf_text", text: pdfText };
    } else {
      if (pdfBuffer.length > MAX_NATIVE_PDF_BYTES) {
        return NextResponse.json(
          {
            error:
              "O PDF do forms.app está grande e não possui texto extraível suficiente. Exporte o formulário como PDF pesquisável ou reduza o arquivo antes de enviar.",
          },
          { status: 413 }
        );
      }

      pdfInput = { type: "pdf_base64", data: pdfBuffer.toString("base64") };
    }

    // Call AI with the smallest safe PDF representation + docx text.
    const { data, tokensUsados } = await extractClienteData(pdfInput, elaboracaoText);
    const legislacoes = await prisma.legislacao.findMany({ where: { ativo: true } });
    const scope = { estadoUf: data.clienteEstado, municipio: data.clienteCidade };
    const legislacoesAssociadas = associarLegislacoesDoDocumento(elaboracaoText, legislacoes, scope);
    const referenciasNaoCadastradas = detectarReferenciasNaoCadastradas(elaboracaoText, legislacoes, scope);

    // Return extracted data + sessionId (pasta is NOT created yet — user reviews first)
    // elaboracaoTextPreview: first 600 chars, shown in UI when docs list is empty
    return NextResponse.json({
      sessionId,
      pdfPath,
      docxPath,
      data,
      tokensUsados,
      legislacoesAssociadas,
      referenciasNaoCadastradas,
      elaboracaoTextPreview: elaboracaoText.slice(0, 600) || null,
    });
  } catch (err) {
    console.error("Erro na extração:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
