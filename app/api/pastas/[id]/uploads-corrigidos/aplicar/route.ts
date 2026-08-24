import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer, saveGeneratedDocx } from "@/lib/file-storage";
import { applyBatchChanges, hashDocx, Substituicao } from "@/lib/header-footer-replace";
import { normalizeHexColor } from "@/lib/logo-replacer";
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
  logoFundoAplicado?: boolean;
  contagens?: Array<{ de: string; total: number; corpo: number; cabecalho: number; rodape: number }>;
  hashOrigem?: string;
  erro?: string;
}

// Processa exatamente um documento por chamada (como /api/gerar). Aplicar um lote
// inteiro dentro de uma única requisição tinha dois problemas na prática: nenhum
// progresso por documento para o operador, e risco real de estourar o limite de
// tempo da função em pastas grandes (40-100+ docs) sem qualquer retorno. O cliente
// percorre um documento por vez.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const contentType = req.headers.get("content-type") || "";
  let docId = "";
  let substituicoes: Substituicao[] = [];
  let logoBuffer: Buffer | undefined;
  let hashOrigem = "";
  let logoBgHexBruto = "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      docId = String(formData.get("docId") || "");
      substituicoes = JSON.parse(String(formData.get("substituicoes") || "[]"));
      hashOrigem = String(formData.get("hashOrigem") || "");
      logoBgHexBruto = String(formData.get("logoBgHex") || "");
      const logo = formData.get("logo") as File | null;
      if (logo && logo.size > 0) logoBuffer = Buffer.from(await logo.arrayBuffer());
    } else {
      const body = await req.json();
      docId = String(body.docId || "");
      substituicoes = Array.isArray(body.substituicoes) ? body.substituicoes : [];
      hashOrigem = String(body.hashOrigem || "");
      logoBgHexBruto = String(body.logoBgHex || "");
    }
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido" }, { status: 400 });
  }

  if (!docId) {
    return NextResponse.json({ error: "Documento obrigatorio" }, { status: 400 });
  }
  const substituicoesValidas = substituicoes.filter((s) => s.de && s.de.trim().length > 0);

  // Hex inválido é recusado em vez de ignorado: `normalizeHexColor` devolve null e a
  // pintura viraria um no-op silencioso, relatando "processado" sobre um documento
  // que não mudou de cor nenhuma.
  const logoBgHex = normalizeHexColor(logoBgHexBruto);
  if (logoBgHexBruto.trim() && !logoBgHex) {
    return NextResponse.json(
      { error: `Cor de fundo da logo invalida: ${logoBgHexBruto}. Use um hex como #1B4332.` },
      { status: 400 }
    );
  }

  if (!logoBuffer && !logoBgHex && substituicoesValidas.length === 0) {
    return NextResponse.json(
      { error: "Informe uma logo nova, uma cor de fundo e/ou ao menos um par de substituicao" },
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

  // Lê a base e confere o hash antes de marcar o documento como em processamento:
  // uma base divergente não pode deixar o registro num estado intermediário.
  const baseRef = doc.outputPath || doc.uploadPath;
  let inputBuffer: Buffer;
  let hashAtual: string;
  try {
    inputBuffer = await readStorageBuffer(baseRef);
    hashAtual = hashDocx(inputBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    await prisma.documentoUpload.update({
      where: { id: doc.id },
      data: { status: "erro", mensagemErro: msg },
    });
    return NextResponse.json({ docId: doc.id, status: "erro", erro: msg } satisfies ItemResultado);
  }

  // `hashOrigem` é opcional para não quebrar quem ainda aplica sem analisar antes.
  // Quando enviado, ele é a trava: o documento mudou desde a análise e os números
  // que o operador viu não valem mais.
  if (hashOrigem && hashOrigem !== hashAtual) {
    return NextResponse.json(
      {
        error: `O documento ${doc.nomeArquivo} mudou desde a analise. Analise novamente antes de aplicar.`,
        docId: doc.id,
        hashOrigem: hashAtual,
      },
      { status: 409 }
    );
  }

  const outputDir = path.join(process.cwd(), "storage", "output", params.id);
  let resultado: ItemResultado;

  try {
    await prisma.documentoUpload.update({ where: { id: doc.id }, data: { status: "processando" } });

    const { buffer, aplicadas, naoEncontradas, logoSubstituida, logoFundoAplicado, contagens } =
      await applyBatchChanges(inputBuffer, {
        logoBuffer,
        substituicoes: substituicoesValidas,
        logoBgHex,
      });

    const versionId = `v${doc.versoes.length + 1}_${randomUUID()}`;
    const fileName = createOutputDocxFileName(`CORRIGIDO_${doc.nomeArquivo}`);
    const outputPath = await saveGeneratedDocx(outputDir, fileName, buffer, versionId);

    await prisma.$transaction([
      prisma.documentoUploadVersao.create({
        data: {
          documentoUploadId: doc.id,
          outputPath,
          substituicoes: JSON.stringify({
            substituicoes: substituicoesValidas,
            logoAplicada: logoSubstituida,
            logoFundoHex: logoFundoAplicado ? `#${logoBgHex}` : null,
          }),
        },
      }),
      prisma.documentoUpload.update({
        where: { id: doc.id },
        data: { status: "processado", outputPath, mensagemErro: null },
      }),
    ]);

    resultado = {
      docId: doc.id,
      status: "processado",
      aplicadas,
      naoEncontradas,
      logoSubstituida,
      logoFundoAplicado,
      contagens: contagens.map(({ de, total, corpo, cabecalho, rodape }) => ({
        de,
        total,
        corpo,
        cabecalho,
        rodape,
      })),
      hashOrigem: hashAtual,
    };
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
