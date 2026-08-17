import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer, saveGeneratedDocx } from "@/lib/file-storage";
import { assertValidDocxBuffer } from "@/lib/docx-validator";
import { hashDocx } from "@/lib/docx-replacement-plan";
import { createOutputDocxFileName } from "@/lib/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Volta um documento do lote para uma base anterior — o upload original ou uma
 * versão intermediária.
 *
 * Existe porque cada rodada de correção parte de `outputPath || uploadPath`, isto
 * é, da última saída: as correções são cumulativas. Sem este passo, um par
 * aplicado por engano ficava incorporado a todas as rodadas seguintes e não havia
 * caminho de volta pela interface.
 *
 * Restaurar é **acréscimo, nunca remoção**: grava um arquivo novo com o conteúdo
 * da base escolhida, registra uma versão a mais e move `outputPath` para ela. As
 * versões existentes, inclusive a que estava vigente, continuam no lugar e podem
 * ser baixadas — restaurar é reversível pelo mesmo mecanismo.
 *
 * O alvo é sempre explícito. Um `alvo` ausente é recusado com 400 em vez de cair
 * num padrão: se a interface deixasse de enviar o campo por um bug, o padrão
 * silencioso descartaria todas as correções do documento.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  let alvo = "";
  let versaoId = "";

  try {
    const body = await req.json();
    alvo = String(body.alvo || "");
    versaoId = String(body.versaoId || "");
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido" }, { status: 400 });
  }

  if (alvo !== "original" && alvo !== "versao") {
    return NextResponse.json(
      { error: "Informe alvo: 'original' para o arquivo enviado ou 'versao' com versaoId" },
      { status: 400 }
    );
  }
  if (alvo === "versao" && !versaoId) {
    return NextResponse.json({ error: "Informe a versao a restaurar" }, { status: 400 });
  }

  const doc = await prisma.documentoUpload.findFirst({
    where: { id: params.uploadId, pastaId: params.id },
    include: { versoes: { select: { id: true, outputPath: true } } },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento nao encontrado" }, { status: 404 });
  }

  // A versão tem de pertencer a este documento; o `include` acima já limita o
  // universo ao documento desta pasta, então não há como restaurar a partir de
  // arquivo de outra pasta informando um id qualquer.
  const versao = alvo === "versao" ? doc.versoes.find((v) => v.id === versaoId) : null;
  if (alvo === "versao" && !versao) {
    return NextResponse.json({ error: "Versao nao encontrada" }, { status: 404 });
  }

  const baseRef = versao ? versao.outputPath : doc.uploadPath;
  const descricaoBase = versao ? "a versao escolhida" : "o arquivo original enviado";

  // Restaurar o que já está vigente só produziria uma cópia inútil e um histórico
  // mais confuso. Recusar é mais informativo do que executar em silêncio.
  const jaVigente = versao ? versao.outputPath === doc.outputPath : !doc.outputPath;
  if (jaVigente) {
    return NextResponse.json(
      { error: `Este documento já está em ${descricaoBase}. Nada a restaurar.` },
      { status: 409 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = await readStorageBuffer(baseRef);
    // Uma base ilegível não pode virar a saída vigente: o operador baixaria um
    // arquivo que o Word recusa e teria perdido o ponteiro para a saída boa.
    assertValidDocxBuffer(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: `Nao foi possivel restaurar ${doc.nomeArquivo}: ${msg}` },
      { status: 422 }
    );
  }

  const outputDir = path.join(process.cwd(), "storage", "output", params.id);
  const versionId = `v${doc.versoes.length + 1}_${randomUUID()}`;
  const fileName = createOutputDocxFileName(`RESTAURADO_${doc.nomeArquivo}`);

  try {
    const outputPath = await saveGeneratedDocx(outputDir, fileName, buffer, versionId);

    await prisma.$transaction([
      prisma.documentoUploadVersao.create({
        data: {
          documentoUploadId: doc.id,
          outputPath,
          substituicoes: JSON.stringify({
            restauradoDe: alvo === "versao" ? { versaoId } : { original: true },
          }),
        },
      }),
      prisma.documentoUpload.update({
        where: { id: doc.id },
        // "restaurado" e não "processado": o operador precisa distinguir na lista
        // um documento corrigido de um que voltou atrás.
        data: { status: "restaurado", outputPath, mensagemErro: null },
      }),
    ]);

    return NextResponse.json({
      docId: doc.id,
      status: "restaurado",
      restauradoDe: alvo,
      outputPath,
      // Qualquer análise feita antes deste ponto está vencida: devolvemos o hash
      // da nova base para o cliente saber que precisa analisar de novo.
      hashOrigem: hashDocx(buffer),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: `Nao foi possivel restaurar ${doc.nomeArquivo}: ${msg}` },
      { status: 500 }
    );
  }
}
