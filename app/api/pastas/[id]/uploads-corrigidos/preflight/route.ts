import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer } from "@/lib/file-storage";
import { planejarSubstituicoes, type Substituicao } from "@/lib/docx-replacement-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Conta, sem alterar nada, o que uma rodada de correção faria em um documento.
 *
 * Processa um documento por chamada, como a rota de aplicar, para o cliente
 * percorrer a lista no mesmo ritmo. Devolve o `hashOrigem` do arquivo analisado:
 * reenviá-lo em `aplicar` trava a aplicação com 409 caso a base tenha mudado
 * entre a análise e a confirmação.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let docId = "";
  let substituicoes: Substituicao[] = [];

  try {
    const body = await req.json();
    docId = String(body.docId || "");
    substituicoes = Array.isArray(body.substituicoes) ? body.substituicoes : [];
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido" }, { status: 400 });
  }

  if (!docId) {
    return NextResponse.json({ error: "Documento obrigatorio" }, { status: 400 });
  }

  const validas = substituicoes.filter((s) => s.de && s.de.trim().length > 0);
  if (validas.length === 0) {
    return NextResponse.json(
      { error: "Informe ao menos um par de substituicao" },
      { status: 400 }
    );
  }

  const doc = await prisma.documentoUpload.findFirst({
    where: { id: docId, pastaId: params.id },
    select: { id: true, nomeArquivo: true, uploadPath: true, outputPath: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento nao encontrado" }, { status: 404 });
  }

  try {
    const buffer = await readStorageBuffer(doc.outputPath || doc.uploadPath);
    const plano = planejarSubstituicoes(buffer, validas);

    return NextResponse.json({
      docId: doc.id,
      nomeArquivo: doc.nomeArquivo,
      // A correção sempre parte da última saída, não do upload original: quando
      // isto é verdadeiro, o operador está corrigindo sobre uma correção anterior.
      baseCorrigida: !!doc.outputPath,
      ...plano,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: `Nao foi possivel analisar ${doc.nomeArquivo}: ${msg}` },
      { status: 422 }
    );
  }
}
