import { NextRequest, NextResponse } from "next/server";
import { extractDocxTextFromBuffer } from "@/lib/extractor";
import { extractClienteData, type PdfInput } from "@/lib/ai";
import { associarLegislacoesDoDocumento } from "@/lib/legislation-matcher";
import { detectarReferenciasNaoCadastradas } from "@/lib/reference-extractor";
import {
  extrairDocumentosDoTextoElaboracao,
  mesclarDocumentosExtraidos,
} from "@/lib/document-list-extractor";
import { complementarClienteComTextoElaboracao } from "@/lib/client-data-fallback";
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

    const elaboracaoText = await extractDocxTextFromBuffer(docxBuffer);

    console.log(`[extrair] docx extraído: ${elaboracaoText.length} chars`);
    console.log(`[extrair] pdf: ${pdfBuffer.length} bytes`);

    const pdfInput: PdfInput = { type: "pdf_base64", data: pdfBuffer.toString("base64") };

    // Call AI with the original PDF document + docx text.
    const { data, tokensUsados } = await extractClienteData(pdfInput, elaboracaoText);
    const dataComplementada = complementarClienteComTextoElaboracao(data, elaboracaoText);
    const documentosIa = data.documentosAGerar || [];
    const documentosDetectadosNoDocx = extrairDocumentosDoTextoElaboracao(elaboracaoText);
    dataComplementada.documentosAGerar = mesclarDocumentosExtraidos(documentosIa, documentosDetectadosNoDocx);
    console.log(
      `[extrair] documentos: IA=${documentosIa.length}, fallback=${documentosDetectadosNoDocx.length}, total=${dataComplementada.documentosAGerar.length}`
    );

    const legislacoes = await prisma.legislacao.findMany({ where: { ativo: true } });
    const scope = { estadoUf: dataComplementada.clienteEstado, municipio: dataComplementada.clienteCidade };
    const legislacoesAssociadas = associarLegislacoesDoDocumento(elaboracaoText, legislacoes, scope);
    const referenciasNaoCadastradas = detectarReferenciasNaoCadastradas(elaboracaoText, legislacoes, scope);

    // Return extracted data + sessionId (pasta is NOT created yet — user reviews first)
    // elaboracaoTextPreview: first 600 chars, shown in UI when docs list is empty
    return NextResponse.json({
      sessionId,
      pdfPath,
      docxPath,
      data: dataComplementada,
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
