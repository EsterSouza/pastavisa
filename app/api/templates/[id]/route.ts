import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { snapshotTemplateVersion } from "@/lib/template-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    await snapshotTemplateVersion(params.id, "Antes da edição de metadados");
    const template = await prisma.template.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json(template);
  } catch (error) {
    console.error("Erro ao atualizar template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar template" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.template.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir template" },
      { status: 500 }
    );
  }
}
