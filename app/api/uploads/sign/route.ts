import { NextRequest, NextResponse } from "next/server";
import { createSignedStorageUpload, safeStorageFileName, storageDriver } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SignRequest {
  pdfName?: string;
  docxName?: string;
}

export async function POST(req: NextRequest) {
  try {
    if (storageDriver() !== "supabase") {
      return NextResponse.json({ mode: "multipart" });
    }

    const publicUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!publicUrl || !publicKey) {
      return NextResponse.json(
        { error: "Configure SUPABASE_ANON_KEY para habilitar uploads grandes em producao." },
        { status: 503 }
      );
    }

    const body = (await req.json()) as SignRequest;
    if (!body.pdfName || !body.docxName) {
      return NextResponse.json({ error: "Nomes dos arquivos ausentes." }, { status: 400 });
    }

    const sessionId = Date.now().toString();
    const [pdf, docx] = await Promise.all([
      createSignedStorageUpload("uploads", `${sessionId}_forms_${safeStorageFileName(body.pdfName)}`),
      createSignedStorageUpload("uploads", `${sessionId}_elaboracao_${safeStorageFileName(body.docxName)}`),
    ]);

    return NextResponse.json({
      mode: "direct",
      supabaseUrl: publicUrl,
      supabaseAnonKey: publicKey,
      bucket: pdf.bucket,
      pdf,
      docx,
    });
  } catch (err) {
    console.error("Erro ao preparar upload direto:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao preparar upload" },
      { status: 500 }
    );
  }
}
