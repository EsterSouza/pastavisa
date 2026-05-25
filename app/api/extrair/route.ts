import { NextRequest, NextResponse } from "next/server";
import { extractDocxTextFromBuffer } from "@/lib/extractor";
import { extractClienteData } from "@/lib/ai";
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

    // Convert PDF to base64 for Anthropic native document support (no pdf-parse needed)
    const pdfBase64 = pdfBuffer.toString("base64");

    // Extract docx text (mammoth — still fine)
    const elaboracaoText = await extractDocxTextFromBuffer(docxBuffer);

    console.log(`[extrair] docx extraído: ${elaboracaoText.length} chars`);

    // Call AI with native PDF + docx text
    const { data, tokensUsados } = await extractClienteData(pdfBase64, elaboracaoText);

    // Return extracted data + sessionId (pasta is NOT created yet — user reviews first)
    // elaboracaoTextPreview: first 600 chars, shown in UI when docs list is empty
    return NextResponse.json({
      sessionId,
      pdfPath,
      docxPath,
      data,
      tokensUsados,
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
