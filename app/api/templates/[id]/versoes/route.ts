import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listTemplateVersions } from "@/lib/template-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const template = await prisma.template.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "Template nao encontrado" }, { status: 404 });
  }

  const versoes = await listTemplateVersions(params.id);
  return NextResponse.json(versoes);
}
