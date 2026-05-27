import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClienteData } from "@/lib/ai";
import { findBestTemplateMatch } from "@/lib/template-matcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DocSelecionado {
  nome: string;
  tipo: string;
}

interface ConfirmarBody {
  pdfPath: string;
  docxPath: string;
  data: ClienteData;
  documentosSelecionados: DocSelecionado[];
  legislacaoIds?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body: ConfirmarBody = await req.json();
    const { pdfPath, docxPath, data, documentosSelecionados, legislacaoIds } = body;

    if (!data || !documentosSelecionados) {
      return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 });
    }

    const pasta = await prisma.pasta.create({
      data: {
        status: "rascunho",
        clienteNomeFantasia: data.clienteNomeFantasia,
        clienteRazaoSocial: data.clienteRazaoSocial,
        clienteCnpj: data.clienteCnpj,
        clienteEndereco: data.clienteEndereco,
        clienteCidade: data.clienteCidade,
        clienteEstado: data.clienteEstado,
        clienteEstadoExtenso: data.clienteEstadoExtenso,
        clienteTelefone: data.clienteTelefone,
        clienteEmail: data.clienteEmail,
        clienteHorario: data.clienteHorario,
        clienteRtNome: data.clienteRtNome,
        clienteRtProfissao: data.clienteRtProfissao,
        clienteRtConselho: data.clienteRtConselho,
        clienteEstrutura: data.clienteEstrutura,
        clienteServicos: JSON.stringify(data.clienteServicos || []),
        clienteEquipamentos: JSON.stringify(data.clienteEquipamentos || []),
        clienteProdutosInsumos: JSON.stringify(data.clienteProdutosInsumos || []),
        clienteTerceirizados: JSON.stringify(data.clienteTerceirizados || []),
        clienteColetaRazao: data.clienteColetaRazao,
        clienteColetaCnpj: data.clienteColetaCnpj,
        clienteResiduosA: data.clienteResiduosA,
        clienteResiduosD: data.clienteResiduosD,
        clienteResiduosE: data.clienteResiduosE,
        formsPdfPath: pdfPath,
        documentosElaboracaoPath: docxPath,
        legislacaoIds: JSON.stringify(Array.isArray(legislacaoIds) ? legislacaoIds : []),
      },
    });

    if (documentosSelecionados.length > 0) {
      const templates = await prisma.template.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, tipo: true, arquivoPath: true },
      });

      await prisma.documentoGerado.createMany({
        data: documentosSelecionados.map((doc) => {
          const match = findBestTemplateMatch(doc.nome, templates);
          return {
            pastaId: pasta.id,
            nomeArquivo: doc.nome,
            status: "pendente",
            templateId: match?.templateId,
          };
        }),
      });
    }

    return NextResponse.json({ pastaId: pasta.id });
  } catch (err) {
    console.error("Erro ao confirmar pasta:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
