import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listTemplateVersions, TemplateVersionUnavailableError } from "@/lib/template-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const template = await prisma.template.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!template) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
    }

    const versoes = await listTemplateVersions(params.id);
    return NextResponse.json(versoes);
  } catch (error) {
    if (error instanceof TemplateVersionUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Erro ao listar versões do template:", error);
    return NextResponse.json({ error: "Erro ao carregar versões do template" }, { status: 500 });
  }
}
