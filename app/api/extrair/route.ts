import { NextRequest, NextResponse } from "next/server";
import { extractDocxTextFromBuffer } from "@/lib/extractor";
import { extractClienteData, extractClienteDataFromElaboracaoText, type ClienteData, type PdfInput } from "@/lib/ai";
import { associarLegislacoesDoDocumento } from "@/lib/legislation-matcher";
import { detectarReferenciasNaoCadastradas } from "@/lib/reference-extractor";
import {
  extrairDocumentosDoTextoElaboracao,
  mesclarDocumentosExtraidos,
} from "@/lib/document-list-extractor";
import { complementarClienteComTextoElaboracao } from "@/lib/client-data-fallback";
import { prisma } from "@/lib/prisma";
import {
  isManagedStorageReference,
  readStorageBuffer,
  saveStorageBuffer,
  storageDriver,
} from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface StoredUploadRequest {
  pdfPath?: string;
  docxPath?: string;
}

function isBlankScalar(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "" || /^(sim|não|nao|yes|no)$/i.test(value.trim());
}

function needsFocusedDocxExtraction(data: ClienteData): boolean {
  return (
    isBlankScalar(data.clienteNomeFantasia) ||
    isBlankScalar(data.clienteRazaoSocial) ||
    isBlankScalar(data.clienteCnpj) ||
    isBlankScalar(data.clienteEndereco) ||
    isBlankScalar(data.clienteRtNome) ||
    !data.clienteServicos?.length ||
    !data.clienteEquipamentos?.length ||
    !data.clienteProdutosInsumos?.length
  );
}

function mergeScalar(primary: string | undefined, fallback: string | undefined): string | undefined {
  return isBlankScalar(primary) ? fallback || undefined : primary;
}

function mergeClienteData(primary: ClienteData, fallback: ClienteData): ClienteData {
  return {
    ...primary,
    clienteNomeFantasia: mergeScalar(primary.clienteNomeFantasia, fallback.clienteNomeFantasia),
    clienteRazaoSocial: mergeScalar(primary.clienteRazaoSocial, fallback.clienteRazaoSocial),
    clienteCnpj: mergeScalar(primary.clienteCnpj, fallback.clienteCnpj),
    clienteEndereco: mergeScalar(primary.clienteEndereco, fallback.clienteEndereco),
    clienteCidade: mergeScalar(primary.clienteCidade, fallback.clienteCidade),
    clienteEstado: mergeScalar(primary.clienteEstado, fallback.clienteEstado),
    clienteEstadoExtenso: mergeScalar(primary.clienteEstadoExtenso, fallback.clienteEstadoExtenso),
    clienteTelefone: mergeScalar(primary.clienteTelefone, fallback.clienteTelefone),
    clienteEmail: mergeScalar(primary.clienteEmail, fallback.clienteEmail),
    clienteHorario: mergeScalar(primary.clienteHorario, fallback.clienteHorario),
    clienteProprietarioNome: mergeScalar(primary.clienteProprietarioNome, fallback.clienteProprietarioNome),
    clienteRtNome: mergeScalar(primary.clienteRtNome, fallback.clienteRtNome),
    clienteRtProfissao: mergeScalar(primary.clienteRtProfissao, fallback.clienteRtProfissao),
    clienteRtConselho: mergeScalar(primary.clienteRtConselho, fallback.clienteRtConselho),
    clienteEstrutura: mergeScalar(primary.clienteEstrutura, fallback.clienteEstrutura),
    clienteMemorialDescritivoMbp: mergeScalar(
      primary.clienteMemorialDescritivoMbp,
      fallback.clienteMemorialDescritivoMbp
    ),
    clienteColetaRazao: mergeScalar(primary.clienteColetaRazao, fallback.clienteColetaRazao),
    clienteColetaCnpj: mergeScalar(primary.clienteColetaCnpj, fallback.clienteColetaCnpj),
    clienteResiduosA: mergeScalar(primary.clienteResiduosA, fallback.clienteResiduosA),
    clienteResiduosD: mergeScalar(primary.clienteResiduosD, fallback.clienteResiduosD),
    clienteResiduosE: mergeScalar(primary.clienteResiduosE, fallback.clienteResiduosE),
    clienteResponsaveisTecnicos: primary.clienteResponsaveisTecnicos?.length
      ? primary.clienteResponsaveisTecnicos
      : fallback.clienteResponsaveisTecnicos || [],
    clienteServicos: primary.clienteServicos?.length ? primary.clienteServicos : fallback.clienteServicos || [],
    clienteFuncionarios: primary.clienteFuncionarios?.length
      ? primary.clienteFuncionarios
      : fallback.clienteFuncionarios || [],
    clienteEquipamentos: primary.clienteEquipamentos?.length
      ? primary.clienteEquipamentos
      : fallback.clienteEquipamentos || [],
    clienteProdutosInsumos: primary.clienteProdutosInsumos?.length
      ? primary.clienteProdutosInsumos
      : fallback.clienteProdutosInsumos || [],
    clienteTerceirizados: primary.clienteTerceirizados?.length
      ? primary.clienteTerceirizados
      : fallback.clienteTerceirizados || [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = Date.now().toString();
    let pdfBuffer: Buffer;
    let docxBuffer: Buffer;
    let pdfPath: string;
    let docxPath: string;

    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = (await req.json()) as StoredUploadRequest;
      if (
        storageDriver() !== "supabase" ||
        !isManagedStorageReference(body.pdfPath, "uploads") ||
        !isManagedStorageReference(body.docxPath, "uploads")
      ) {
        return NextResponse.json({ error: "Referencias de upload invalidas" }, { status: 400 });
      }

      pdfPath = body.pdfPath!;
      docxPath = body.docxPath!;
      [pdfBuffer, docxBuffer] = await Promise.all([
        readStorageBuffer(pdfPath),
        readStorageBuffer(docxPath),
      ]);
    } else {
      const formData = await req.formData();
      const pdfFile = formData.get("formsPdf") as File | null;
      const docxFile = formData.get("documentosElaboracao") as File | null;

      if (!pdfFile || !docxFile) {
        return NextResponse.json({ error: "Arquivos obrigatórios ausentes" }, { status: 400 });
      }

      const pdfFileName = `${sessionId}_forms.pdf`;
      const docxFileName = `${sessionId}_elaboracao.docx`;
      pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
      docxBuffer = Buffer.from(await docxFile.arrayBuffer());
      pdfPath = await saveStorageBuffer("uploads", pdfFileName, pdfBuffer, "application/pdf");
      docxPath = await saveStorageBuffer(
        "uploads",
        docxFileName,
        docxBuffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    }

    const elaboracaoText = await extractDocxTextFromBuffer(docxBuffer);

    console.log(`[extrair] docx extraído: ${elaboracaoText.length} chars`);
    console.log(`[extrair] pdf: ${pdfBuffer.length} bytes`);

    const pdfInput: PdfInput = { type: "pdf_base64", data: pdfBuffer.toString("base64") };

    // Call AI with the original PDF document + docx text.
    const { data, tokensUsados } = await extractClienteData(pdfInput, elaboracaoText);
    let dataExtraida = data;
    let tokensTotais = tokensUsados;

    if (needsFocusedDocxExtraction(dataExtraida)) {
      const focused = await extractClienteDataFromElaboracaoText(elaboracaoText);
      dataExtraida = mergeClienteData(dataExtraida, focused.data);
      tokensTotais += focused.tokensUsados;
      console.log(`[extrair] extração focada do docx usada: ${focused.tokensUsados} tokens`);
    }

    const dataComplementada = complementarClienteComTextoElaboracao(dataExtraida, elaboracaoText);
    const documentosIa = data.documentosAGerar || [];
    const documentosDetectadosNoDocx = extrairDocumentosDoTextoElaboracao(elaboracaoText);
    dataComplementada.documentosAGerar = mesclarDocumentosExtraidos(documentosIa, documentosDetectadosNoDocx);
    console.log(
      `[extrair] documentos: IA=${documentosIa.length}, fallback=${documentosDetectadosNoDocx.length}, total=${dataComplementada.documentosAGerar.length}`
    );

    const legislacoes = await prisma.legislacao.findMany({ where: { ativo: true } });
    const scope = { estadoUf: dataComplementada.clienteEstado, municipio: dataComplementada.clienteCidade };
    const legislacoesAssociadas = associarLegislacoesDoDocumento(elaboracaoText, legislacoes, scope);
    const referenciasNaoCadastradas = detectarReferenciasNaoCadastradas(elaboracaoText, legislacoes, scope);

    // Return extracted data + sessionId (pasta is NOT created yet — user reviews first)
    // elaboracaoTextPreview: first 600 chars, shown in UI when docs list is empty
    return NextResponse.json({
      sessionId,
      pdfPath,
      docxPath,
      data: dataComplementada,
      tokensUsados: tokensTotais,
      legislacoesAssociadas,
      referenciasNaoCadastradas,
      elaboracaoTextPreview: elaboracaoText.slice(0, 600) || null,
    });
  } catch (err) {
    console.error("Erro na extração:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
