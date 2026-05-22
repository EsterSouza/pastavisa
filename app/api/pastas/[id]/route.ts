import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASTA_EDIT_FIELDS = [
  "status",
  "clienteNomeFantasia",
  "clienteRazaoSocial",
  "clienteCnpj",
  "clienteEndereco",
  "clienteCidade",
  "clienteEstado",
  "clienteEstadoExtenso",
  "clienteTelefone",
  "clienteEmail",
  "clienteHorario",
  "clienteRtNome",
  "clienteRtProfissao",
  "clienteRtConselho",
  "clienteEstrutura",
  "clienteMemorialDescritivoMbp",
  "clienteServicos",
  "clienteFuncionarios",
  "clienteEquipamentos",
  "clienteProdutosInsumos",
  "clienteTerceirizados",
  "clienteColetaRazao",
  "clienteColetaCnpj",
  "clienteResiduosA",
  "clienteResiduosD",
  "clienteResiduosE",
  "clienteInfoAdicionais",
  "docElaborador",
  "docMesExtenso",
  "docAno",
] as const;

const PASTA_STATUS = new Set(["rascunho", "processando", "concluida"]);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pasta = await prisma.pasta.findUnique({
    where: { id: params.id },
    include: { documentos: { include: { template: true } } },
  });
  if (!pasta) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  return NextResponse.json(pasta);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (Object.prototype.hasOwnProperty.call(body, "status") && !PASTA_STATUS.has(body.status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }

  const data = Object.fromEntries(
    PASTA_EDIT_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]])
  );

  const pasta = await prisma.pasta.update({ where: { id: params.id }, data });
  return NextResponse.json(pasta);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.pasta.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
