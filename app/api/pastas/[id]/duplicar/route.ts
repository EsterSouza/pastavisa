import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const original = await prisma.pasta.findUnique({
    where: { id: params.id },
    include: { documentos: true },
  });
  if (!original) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  }

  const novaPasta = await prisma.pasta.create({
    data: {
      status: "rascunho",
      clienteNomeFantasia: original.clienteNomeFantasia,
      clienteRazaoSocial: original.clienteRazaoSocial,
      clienteCnpj: original.clienteCnpj,
      clienteEndereco: original.clienteEndereco,
      clienteCidade: original.clienteCidade,
      clienteEstado: original.clienteEstado,
      clienteEstadoExtenso: original.clienteEstadoExtenso,
      clienteTelefone: original.clienteTelefone,
      clienteEmail: original.clienteEmail,
      clienteHorario: original.clienteHorario,
      clienteProprietarioNome: original.clienteProprietarioNome,
      clienteRtNome: original.clienteRtNome,
      clienteRtProfissao: original.clienteRtProfissao,
      clienteRtConselho: original.clienteRtConselho,
      clienteResponsaveisTecnicos: original.clienteResponsaveisTecnicos,
      clienteLogoPath: original.clienteLogoPath,
      clienteEstrutura: original.clienteEstrutura,
      clienteMemorialDescritivoMbp: original.clienteMemorialDescritivoMbp,
      clienteServicos: original.clienteServicos,
      clienteFuncionarios: original.clienteFuncionarios,
      clienteEquipamentos: original.clienteEquipamentos,
      clienteProdutosInsumos: original.clienteProdutosInsumos,
      clienteTerceirizados: original.clienteTerceirizados,
      clienteColetaRazao: original.clienteColetaRazao,
      clienteColetaCnpj: original.clienteColetaCnpj,
      clienteResiduosA: original.clienteResiduosA,
      clienteResiduosD: original.clienteResiduosD,
      clienteResiduosE: original.clienteResiduosE,
      clienteInfoAdicionais: original.clienteInfoAdicionais,
      docElaborador: original.docElaborador,
      docMesExtenso: original.docMesExtenso,
      docAno: original.docAno,
      legislacaoIds: original.legislacaoIds,
      documentos: {
        create: original.documentos.map((doc) => ({
          nomeArquivo: doc.nomeArquivo,
          templateId: doc.templateId,
          equipamentosSelecionados: doc.equipamentosSelecionados,
          status: "pendente",
        })),
      },
    },
  });

  return NextResponse.json({ pastaId: novaPasta.id }, { status: 201 });
}
