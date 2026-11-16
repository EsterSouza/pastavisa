import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveStorageBuffer } from "@/lib/file-storage";
import { extractDocxTextFromBuffer } from "@/lib/extractor";
import { extrairDocumentosDoTextoElaboracao } from "@/lib/document-list-extractor";
import { associarLegislacoesDoDocumento } from "@/lib/legislation-matcher";
import { detectarReferenciasNaoCadastradas } from "@/lib/reference-extractor";
import { findBestTemplateMatch } from "@/lib/template-matcher";
import { lerPrazosDaPasta } from "@/lib/elaboracao-prazos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chave = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

/**
 * Troca o "Documentos em elaboração" da pasta pela versão final (a que a Ester fecha
 * no Cowork) e relê dele, sem IA, a lista de documentos, os prazos, a versão e as
 * legislações. Os dados da cliente ficam como estão.
 *
 * Documento que saiu da lista só é apagado se ainda não foi gerado; o que já tem
 * arquivo fica e volta na resposta para a Ester decidir.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const pasta = await prisma.pasta.findUnique({
      where: { id: params.id },
      select: { id: true, clienteEstado: true, clienteCidade: true },
    });
    if (!pasta) return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });

    const form = await req.formData();
    const arquivo = form.get("documentosElaboracao");
    if (!(arquivo instanceof File) || !/\.docx$/i.test(arquivo.name)) {
      return NextResponse.json({ error: "Envie o Documentos em elaboração em .docx." }, { status: 400 });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const texto = await extractDocxTextFromBuffer(buffer);
    const lidos = extrairDocumentosDoTextoElaboracao(texto);
    if (lidos.length === 0) {
      return NextResponse.json(
        { error: "Não achei a lista de documentos nesse arquivo. Confira se é o Documentos em elaboração." },
        { status: 400 }
      );
    }

    const caminho = await saveStorageBuffer(
      "uploads",
      `${Date.now()}_elaboracao.docx`,
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    const [existentes, templates, legislacoes, todasLegislacoes] = await Promise.all([
      prisma.documentoGerado.findMany({
        where: { pastaId: pasta.id },
        select: { id: true, nomeArquivo: true, status: true, outputPath: true },
      }),
      prisma.template.findMany({ where: { ativo: true }, select: { id: true, nome: true, tipo: true, arquivoPath: true } }),
      prisma.legislacao.findMany({ where: { ativo: true } }),
      prisma.legislacao.findMany(),
    ]);

    const novosPorChave = new Map(lidos.map((d) => [chave(d.nome), d]));
    const existentesPorChave = new Map(existentes.map((d) => [chave(d.nomeArquivo), d]));
    const entram = lidos.filter((d) => !existentesPorChave.has(chave(d.nome)));
    const saem = existentes.filter((d) => !novosPorChave.has(chave(d.nomeArquivo)));
    const apagar = saem.filter((d) => d.status === "pendente" && !d.outputPath);
    const jaGerados = saem.filter((d) => !apagar.includes(d)).map((d) => d.nomeArquivo);

    const scope = { estadoUf: pasta.clienteEstado, municipio: pasta.clienteCidade };
    const associadas = associarLegislacoesDoDocumento(texto, legislacoes, scope);
    const referenciasNaoCadastradas = detectarReferenciasNaoCadastradas(texto, todasLegislacoes, scope);

    await prisma.$transaction([
      prisma.documentoGerado.deleteMany({ where: { id: { in: apagar.map((d) => d.id) } } }),
      prisma.documentoGerado.createMany({
        data: entram.map((d) => ({
          pastaId: pasta.id,
          nomeArquivo: d.nome,
          status: "pendente",
          templateId: findBestTemplateMatch(d.nome, templates)?.templateId,
        })),
      }),
      prisma.pasta.update({
        where: { id: pasta.id },
        data: {
          documentosElaboracaoPath: caminho,
          legislacaoIds: JSON.stringify(associadas.map((l) => l.id)),
        },
      }),
    ]);

    // Os prazos saem do arquivo novo; um erro aqui não desfaz a troca.
    const prazos = await lerPrazosDaPasta(pasta.id).catch(() => ({}));

    return NextResponse.json({
      documentos: lidos.length,
      acrescentados: entram.map((d) => d.nome),
      retirados: apagar.map((d) => d.nomeArquivo),
      jaGerados,
      legislacoes: associadas.length,
      referenciasNaoCadastradas,
      prazos,
    });
  } catch (error) {
    console.error("[elaboracao] troca falhou:", error);
    const message = error instanceof Error ? error.message : "Não deu para atualizar o Documentos em elaboração.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
