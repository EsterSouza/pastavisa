import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { snapshotTemplateVersion } from "@/lib/template-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  await snapshotTemplateVersion(params.id, "Antes da edicao de metadados");
  const template = await prisma.template.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(template);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.template.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
