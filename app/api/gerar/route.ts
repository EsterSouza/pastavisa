import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  createOutputDocxFileName,
  DocumentoGuiaItem,
  EquipamentoDocumento,
  gerarDocumento,
  hasRtInBody,
  LegislacoesTexto,
} from "@/lib/generator";
import { ClienteData } from "@/lib/ai";
import { ProcessingType } from "@/lib/classifier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function parseEquipamentosSelecionados(value?: string | null): EquipamentoDocumento[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseLegislacaoIds(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { pastaId, documentoIds, legislacaoIds } = await req.json();

  if (!pastaId) {
    return NextResponse.json({ error: "pastaId obrigatório" }, { status: 400 });
  }

  const pasta = await prisma.pasta.findUnique({
    where: { id: pastaId },
    include: { documentos: { include: { template: true, versoes: true } } },
  });

  if (!pasta) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  }

  const clienteData: ClienteData = {
    clienteNomeFantasia: pasta.clienteNomeFantasia || undefined,
    clienteRazaoSocial: pasta.clienteRazaoSocial || undefined,
    clienteCnpj: pasta.clienteCnpj || undefined,
    clienteEndereco: pasta.clienteEndereco || undefined,
    clienteCidade: pasta.clienteCidade || undefined,
    clienteEstado: pasta.clienteEstado || undefined,
    clienteEstadoExtenso: pasta.clienteEstadoExtenso || undefined,
    clienteTelefone: pasta.clienteTelefone || undefined,
    clienteEmail: pasta.clienteEmail || undefined,
    clienteHorario: pasta.clienteHorario || undefined,
    clienteProprietarioNome: pasta.clienteProprietarioNome || undefined,
    clienteRtNome: pasta.clienteRtNome || undefined,
    clienteRtProfissao: pasta.clienteRtProfissao || undefined,
    clienteRtConselho: pasta.clienteRtConselho || undefined,
    clienteResponsaveisTecnicos: pasta.clienteResponsaveisTecnicos ? JSON.parse(pasta.clienteResponsaveisTecnicos) : [],
    clienteEstrutura: pasta.clienteEstrutura || undefined,
    clienteMemorialDescritivoMbp: pasta.clienteMemorialDescritivoMbp || undefined,
    clienteServicos: pasta.clienteServicos ? JSON.parse(pasta.clienteServicos) : [],
    clienteFuncionarios: pasta.clienteFuncionarios ? JSON.parse(pasta.clienteFuncionarios) : [],
    clienteEquipamentos: pasta.clienteEquipamentos ? JSON.parse(pasta.clienteEquipamentos) : [],
    clienteProdutosInsumos: pasta.clienteProdutosInsumos ? JSON.parse(pasta.clienteProdutosInsumos) : [],
    clienteTerceirizados: pasta.clienteTerceirizados ? JSON.parse(pasta.clienteTerceirizados) : [],
    clienteColetaRazao: pasta.clienteColetaRazao || undefined,
    clienteColetaCnpj: pasta.clienteColetaCnpj || undefined,
    clienteResiduosA: pasta.clienteResiduosA || undefined,
    clienteResiduosD: pasta.clienteResiduosD || undefined,
    clienteResiduosE: pasta.clienteResiduosE || undefined,
  };

  // References are sourced from the list recognized in the uploaded elaboration document.
  const idsSelecionados = Array.isArray(legislacaoIds)
    ? legislacaoIds.filter((item): item is string => typeof item === "string")
    : parseLegislacaoIds(pasta.legislacaoIds);
  if (Array.isArray(legislacaoIds)) {
    await prisma.pasta.update({
      where: { id: pastaId },
      data: { legislacaoIds: JSON.stringify(idsSelecionados) },
    });
  }
  const legislacoesFiltradas = await prisma.legislacao.findMany({
    where: { ativo: true, id: { in: idsSelecionados } },
    orderBy: { titulo: "asc" },
  });

  const legislacoesTexto: LegislacoesTexto = {
    federal: legislacoesFiltradas.filter((l) => l.estadoUf === "BR" && !l.municipio),
    estadual: legislacoesFiltradas.filter((l) => l.estadoUf !== "BR" && !l.municipio),
    municipal: legislacoesFiltradas.filter((l) => !!l.municipio),
  };

  const outputDir = path.join(process.cwd(), "storage", "output", pastaId);
  const docsToProcess = documentoIds
    ? pasta.documentos.filter((d: { id: string }) => documentoIds.includes(d.id))
    : pasta.documentos;

  const results: Array<{
    id: string;
    status: string;
    nomeArquivo: string;
    logoSubstituida?: boolean;
    avisoRt?: boolean;
    tokensUsados?: number;
    outputPath?: string;
    error?: string;
  }> = [];

  await prisma.pasta.update({ where: { id: pastaId }, data: { status: "processando" } });
  const usedOutputNames = new Set<string>();

  // Build the full planned document list for guide/index generation.
  // This intentionally uses every document in the folder, not only the checked batch.
  const documentosDaPasta: DocumentoGuiaItem[] = pasta.documentos.map(
    (d: { nomeArquivo: string; template?: { tipo?: string | null } | null }) => ({
      nome: d.nomeArquivo,
      tipo: d.template?.tipo,
    })
  );

  const documentosListados = documentosDaPasta
    .map((d) => `- ${d.nome}`)
    .join("\n");

  for (const doc of docsToProcess) {
    if (!doc.templateId || !doc.template) {
      await prisma.documentoGerado.update({
        where: { id: doc.id },
        data: { status: "erro", mensagemErro: "Nenhum template selecionado" },
      });
      results.push({ id: doc.id, status: "erro", nomeArquivo: doc.nomeArquivo, error: "Nenhum template selecionado" });
      continue;
    }

    await prisma.documentoGerado.update({ where: { id: doc.id }, data: { status: "processando" } });

    try {
      const nomeArquivo = createOutputDocxFileName(doc.nomeArquivo, usedOutputNames);
      usedOutputNames.add(nomeArquivo.toLocaleUpperCase("pt-BR"));
      let numeroVersao = doc.versoes.length + 1;

      if (doc.outputPath && !doc.versoes.some((versao) => versao.outputPath === doc.outputPath)) {
        await prisma.documentoVersao.create({
          data: {
            documentoId: doc.id,
            outputPath: doc.outputPath,
            tokensUsados: doc.tokensUsados,
            logoSubstituida: doc.logoSubstituida,
            avisoRtNoCorpo: doc.avisoRtNoCorpo,
          },
        });
        numeroVersao += 1;
      }

      // Check if RT appears in body
      const rtNoCorpo = await hasRtInBody(doc.template.arquivoPath);

      const { outputPath, tokensTotal, logoSubstituida } = await gerarDocumento(
        doc.template.arquivoPath,
        outputDir,
        nomeArquivo,
        clienteData,
        {
          processingType: (doc.template.processingType as ProcessingType) || "LIGHT_HAIKU",
          logoPath: pasta.clienteLogoPath,
          logoBgHex: pasta.clienteLogoBgHex,
          criadaEm: pasta.criadaEm,
          documentosListados,
          documentosDaPasta,
          docElaborador: pasta.docElaborador || undefined,
          docMesExtenso: pasta.docMesExtenso || undefined,
          docAno: pasta.docAno || undefined,
          legislacoesTexto,
          documentoTipo: doc.template.tipo,
          documentoNome: doc.nomeArquivo,
          equipamentosDoPop: parseEquipamentosSelecionados(doc.equipamentosSelecionados),
          storageVersionId: `v${numeroVersao}_${randomUUID()}`,
          numeroVersao,
        },
        (msg) => console.log(`[${doc.nomeArquivo}] ${msg}`)
      );

      await prisma.$transaction([
        prisma.documentoVersao.create({
          data: {
            documentoId: doc.id,
            outputPath,
            tokensUsados: tokensTotal,
            logoSubstituida,
            avisoRtNoCorpo: rtNoCorpo,
          },
        }),
        prisma.documentoGerado.update({
          where: { id: doc.id },
          data: {
            status: "gerado",
            outputPath,
            tokensUsados: tokensTotal,
            logoSubstituida,
            avisoRtNoCorpo: rtNoCorpo,
          },
        }),
      ]);

      results.push({ id: doc.id, status: "gerado", nomeArquivo, outputPath, logoSubstituida, avisoRt: rtNoCorpo, tokensUsados: tokensTotal });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      await prisma.documentoGerado.update({
        where: { id: doc.id },
        data: { status: "erro", mensagemErro: msg },
      });
      results.push({ id: doc.id, status: "erro", nomeArquivo: doc.nomeArquivo, error: msg });
    }
  }

  const allDone = await prisma.documentoGerado.findMany({ where: { pastaId } });
  const allGerado = allDone.every((d: { status: string }) => d.status === "gerado" || d.status === "erro");
  if (allGerado) {
    await prisma.pasta.update({ where: { id: pastaId }, data: { status: "concluida" } });
  }

  return NextResponse.json({ results });
}
