import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveStorageBuffer, safeStorageFileName } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formData = await req.formData();
    const file = formData.get("logo") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });

    const ext = file.name.split(".").pop() || "png";
    const fileName = safeStorageFileName(`${params.id}_logo.${ext}`);
    const filePath = await saveStorageBuffer(
      "logos",
      fileName,
      Buffer.from(await file.arrayBuffer()),
      file.type || undefined
    );

    await prisma.pasta.update({
      where: { id: params.id },
      data: { clienteLogoPath: filePath },
    });

    return NextResponse.json({ path: filePath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar logo" },
      { status: 500 }
    );
  }
}
