import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer, saveGeneratedDocx } from "@/lib/file-storage";
import { applyBatchChanges, Substituicao } from "@/lib/header-footer-replace";
import { createOutputDocxFileName } from "@/lib/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ItemResultado {
  docId: string;
  status: "processado" | "erro";
  aplicadas?: string[];
  naoEncontradas?: string[];
  logoSubstituida?: boolean;
  erro?: string;
}

// Processes exactly one document per call (like /api/gerar). Applying an
// entire batch inside a single request had two problems in practice: no
// per-document progress for the operator, and a real risk of hitting the
// serverless function time limit on large folders (40-100+ docs) with zero
// feedback if it did. The client now loops one document at a time instead.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const contentType = req.headers.get("content-type") || "";
  let docId = "";
  let substituicoes: Substituicao[] = [];
  let logoBuffer: Buffer | undefined;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      docId = String(formData.get("docId") || "");
      substituicoes = JSON.parse(String(formData.get("substituicoes") || "[]"));
      const logo = formData.get("logo") as File | null;
      if (logo && logo.size > 0) logoBuffer = Buffer.from(await logo.arrayBuffer());
    } else {
      const body = await req.json();
      docId = String(body.docId || "");
      substituicoes = Array.isArray(body.substituicoes) ? body.substituicoes : [];
    }
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido" }, { status: 400 });
  }

  if (!docId) {
    return NextResponse.json({ error: "Documento obrigatorio" }, { status: 400 });
  }
  const substituicoesValidas = substituicoes.filter((s) => s.de && s.de.trim().length > 0);
  if (!logoBuffer && substituicoesValidas.length === 0) {
    return NextResponse.json(
      { error: "Informe uma logo nova e/ou ao menos um par de substituicao" },
      { status: 400 }
    );
  }

  const doc = await prisma.documentoUpload.findFirst({
    where: { id: docId, pastaId: params.id },
    include: { versoes: { select: { outputPath: true } } },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento nao encontrado" }, { status: 404 });
  }

  const outputDir = path.join(process.cwd(), "storage", "output", params.id);
  let resultado: ItemResultado;

  try {
    await prisma.documentoUpload.update({ where: { id: doc.id }, data: { status: "processando" } });

    const baseRef = doc.outputPath || doc.uploadPath;
    const inputBuffer = await readStorageBuffer(baseRef);

    const { buffer, aplicadas, naoEncontradas, logoSubstituida } = await applyBatchChanges(inputBuffer, {
      logoBuffer,
      substituicoes: substituicoesValidas,
    });

    const versionId = `v${doc.versoes.length + 1}_${randomUUID()}`;
    const fileName = createOutputDocxFileName(`CORRIGIDO_${doc.nomeArquivo}`);
    const outputPath = await saveGeneratedDocx(outputDir, fileName, buffer, versionId);

    await prisma.$transaction([
      prisma.documentoUploadVersao.create({
        data: {
          documentoUploadId: doc.id,
          outputPath,
          substituicoes: JSON.stringify({ substituicoes: substituicoesValidas, logoAplicada: logoSubstituida }),
        },
      }),
      prisma.documentoUpload.update({
        where: { id: doc.id },
        data: { status: "processado", outputPath, mensagemErro: null },
      }),
    ]);

    resultado = { docId: doc.id, status: "processado", aplicadas, naoEncontradas, logoSubstituida };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    await prisma.documentoUpload.update({
      where: { id: doc.id },
      data: { status: "erro", mensagemErro: msg },
    });
    resultado = { docId: doc.id, status: "erro", erro: msg };
  }

  return NextResponse.json(resultado);
}
