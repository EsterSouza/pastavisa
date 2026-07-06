import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer, saveGeneratedDocx } from "@/lib/file-storage";
import { applyBatchChanges, Substituicao } from "@/lib/header-footer-replace";
import { createOutputDocxFileName } from "@/lib/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ItemResultado {
  docId: string;
  status: "processado" | "erro";
  aplicadas?: string[];
  naoEncontradas?: string[];
  logoSubstituida?: boolean;
  erro?: string;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const contentType = req.headers.get("content-type") || "";
  let docIds: string[] = [];
  let substituicoes: Substituicao[] = [];
  let logoBuffer: Buffer | undefined;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      docIds = JSON.parse(String(formData.get("docIds") || "[]"));
      substituicoes = JSON.parse(String(formData.get("substituicoes") || "[]"));
      const logo = formData.get("logo") as File | null;
      if (logo && logo.size > 0) logoBuffer = Buffer.from(await logo.arrayBuffer());
    } else {
      const body = await req.json();
      docIds = Array.isArray(body.docIds) ? body.docIds : [];
      substituicoes = Array.isArray(body.substituicoes) ? body.substituicoes : [];
    }
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido" }, { status: 400 });
  }

  if (docIds.length === 0) {
    return NextResponse.json({ error: "Nenhum documento selecionado" }, { status: 400 });
  }
  const substituicoesValidas = substituicoes.filter((s) => s.de && s.de.trim().length > 0);
  if (!logoBuffer && substituicoesValidas.length === 0) {
    return NextResponse.json(
      { error: "Informe uma logo nova e/ou ao menos um par de substituicao" },
      { status: 400 }
    );
  }

  const docs = await prisma.documentoUpload.findMany({
    where: { id: { in: docIds }, pastaId: params.id },
    include: { versoes: { select: { outputPath: true } } },
  });

  const outputDir = path.join(process.cwd(), "storage", "output", params.id);
  const resultados: ItemResultado[] = [];

  for (const doc of docs) {
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

      resultados.push({ docId: doc.id, status: "processado", aplicadas, naoEncontradas, logoSubstituida });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      await prisma.documentoUpload.update({
        where: { id: doc.id },
        data: { status: "erro", mensagemErro: msg },
      });
      resultados.push({ docId: doc.id, status: "erro", erro: msg });
    }
  }

  return NextResponse.json({ resultados });
}
