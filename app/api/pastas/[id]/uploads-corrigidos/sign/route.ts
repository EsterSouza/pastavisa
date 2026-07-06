import { NextRequest, NextResponse } from "next/server";
import { createSignedStorageUpload, safeStorageFileName, storageDriver } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (storageDriver() !== "supabase") {
      if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        return NextResponse.json(
          {
            error:
              "Uploads grandes exigem Supabase Storage em producao. Configure FILE_STORAGE_DRIVER=supabase, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
          },
          { status: 503 }
        );
      }
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

    const body = await req.json();
    const fileNames: string[] = Array.isArray(body.fileNames)
      ? body.fileNames.filter((n: unknown) => typeof n === "string")
      : [];
    if (fileNames.length === 0) {
      return NextResponse.json({ error: "Nomes dos arquivos ausentes." }, { status: 400 });
    }

    const sessionId = Date.now().toString();
    const uploads = await Promise.all(
      fileNames.map(async (name, index) => {
        const signed = await createSignedStorageUpload(
          "uploads",
          `${params.id}_${sessionId}_${index}_${safeStorageFileName(name)}`
        );
        return { nomeArquivo: name, ...signed };
      })
    );

    return NextResponse.json({
      mode: "direct",
      supabaseUrl: publicUrl,
      supabaseAnonKey: publicKey,
      bucket: uploads[0]?.bucket,
      uploads,
    });
  } catch (err) {
    console.error("Erro ao preparar upload direto de correcoes:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao preparar upload" },
      { status: 500 }
    );
  }
}
