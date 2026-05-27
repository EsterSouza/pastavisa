import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer } from "@/lib/file-storage";
import { validateTemplateBuffer } from "@/lib/template-validator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = await prisma.template.findUnique({ where: { id: params.id } });
  if (!template) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  try {
    const report = validateTemplateBuffer(await readStorageBuffer(template.arquivoPath));
    return NextResponse.json(report);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível analisar este arquivo DOCX." },
      { status: 422 }
    );
  }
}
