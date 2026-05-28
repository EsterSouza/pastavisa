import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectProcessingType } from "@/lib/classifier";
import { safeStorageFileName, saveStorageBuffer } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    const templates = await prisma.template.findMany({ orderBy: { criadoEm: "desc" } });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Erro ao carregar templates:", error);
    return NextResponse.json({ error: "Erro ao carregar templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("arquivo") as File | null;
    const nome = formData.get("nome") as string;
    const tipo = formData.get("tipo") as string;
    const padraoHeader = formData.get("padraoHeader") as string;
    const processingType = (formData.get("processingType") as string) || detectProcessingType(nome || "");

    if (!file || !nome || !tipo || !padraoHeader) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    const fileName = safeStorageFileName(`${Date.now()}_${file.name}`);
    const filePath = await saveStorageBuffer(
      "templates",
      fileName,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    const template = await prisma.template.create({
      data: { nome, tipo, padraoHeader, processingType, arquivoPath: filePath },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar template" },
      { status: 500 }
    );
  }
}
