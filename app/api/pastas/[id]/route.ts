import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/authorization";
import { excluirPasta } from "@/lib/pasta-exclusao";
import { dataDoBanco } from "@/lib/elaboracao-prazos";
import { ehEtapa, gravacaoDaEtapa } from "@/lib/etapas";

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
  "clienteProprietarioNome",
  "clienteRtNome",
  "clienteRtProfissao",
  "clienteRtConselho",
  "clienteResponsaveisTecnicos",
  "clienteLogoBgHex",
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
  "legislacaoIds",
  "versaoPasta",
  "linkDrive",
  "linkOneDrive",
  "senhaOneDrive",
] as const;

// Chegam como AAAA-MM-DD (input date) ou vazias.
const PASTA_DATE_FIELDS = ["inicioProjeto", "apreciacaoInicio", "apreciacaoFim", "entregaFinal"] as const;

const PASTA_STATUS = new Set(["rascunho", "processando", "concluida"]);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pasta = await prisma.pasta.findUnique({
    where: { id: params.id },
    include: {
      documentos: {
        include: {
          template: true,
          versoes: { orderBy: { criadaEm: "desc" } },
        },
      },
    },
  });
  if (!pasta) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  return NextResponse.json(pasta);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    if (Object.prototype.hasOwnProperty.call(body, "status") && !PASTA_STATUS.has(body.status)) {
      return NextResponse.json({ error: "Status invalido" }, { status: 400 });
    }

    const data: Record<string, unknown> = Object.fromEntries(
      PASTA_EDIT_FIELDS
        .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
        .map((field) => [field, body[field]])
    );
    for (const field of PASTA_DATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = dataDoBanco(body[field]);
    }

    const atual =
      "status" in data || "etapa" in body
        ? await prisma.pasta.findUnique({ where: { id: params.id }, select: { status: true } })
        : null;

    // A etapa vira status e etapa gravados: "entregue" conclui, as outras reabrem.
    if ("etapa" in body) {
      if (!ehEtapa(body.etapa)) return NextResponse.json({ error: "Etapa invalida" }, { status: 400 });
      Object.assign(data, gravacaoDaEtapa(body.etapa, atual?.status || ""));
    }

    // A retenção conta 30 dias a partir da conclusão. Só a troca de status mexe
    // na data: salvar de novo uma pasta já concluída não pode adiar a exclusão.
    if ("status" in data) {
      if (atual && atual.status !== data.status) {
        data.concluidaEm = data.status === "concluida" ? new Date() : null;
      }
    }

    const pasta = await prisma.pasta.update({ where: { id: params.id }, data });
    return NextResponse.json(pasta);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar pasta" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const authorization = await requireAdmin();
  if (authorization) return authorization;

  try {
    if (!(await excluirPasta(params.id))) {
      return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir pasta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
