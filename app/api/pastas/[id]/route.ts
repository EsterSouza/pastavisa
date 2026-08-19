import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteGeneratedDocx, deleteLogoFile, deleteUploadedFile } from "@/lib/file-storage";
import { requireAdmin } from "@/lib/auth/authorization";

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
] as const;

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

    const data = Object.fromEntries(
      PASTA_EDIT_FIELDS
        .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
        .map((field) => [field, body[field]])
    );

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
    const pasta = await prisma.pasta.findUnique({
      where: { id: params.id },
      include: {
        documentos: { include: { versoes: true } },
        documentosUpload: { include: { versoes: true } },
      },
    });
    if (!pasta) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

    const outputPaths = new Set<string>();
    pasta.documentos.forEach((doc) => {
      if (doc.outputPath) outputPaths.add(doc.outputPath);
      doc.versoes.forEach((versao) => outputPaths.add(versao.outputPath));
    });
    pasta.documentosUpload.forEach((doc) => {
      if (doc.outputPath) outputPaths.add(doc.outputPath);
      doc.versoes.forEach((versao) => outputPaths.add(versao.outputPath));
    });
    // O que o cliente enviou sai junto com a pasta: o original de cada correção
    // e os dois arquivos da extração. Antes ficavam para trás, porque a remoção
    // só alcançava `storage/output` — arquivo sem dono, invisível na tela,
    // impossível de baixar e ocupando cota. Foi o que o PV-026 mediu em 19/08.
    const uploadPaths = new Set<string>();
    pasta.documentosUpload.forEach((doc) => {
      if (doc.uploadPath) uploadPaths.add(doc.uploadPath);
    });
    if (pasta.formsPdfPath) uploadPaths.add(pasta.formsPdfPath);
    if (pasta.documentosElaboracaoPath) uploadPaths.add(pasta.documentosElaboracaoPath);

    // A logo é o único arquivo com mais de um dono possível: `duplicar` copia o
    // `clienteLogoPath` para a pasta nova em vez de gerar cópia no Storage. Só
    // sai quando nenhuma outra pasta aponta para ela.
    const logoDeOutraPasta = pasta.clienteLogoPath
      ? await prisma.pasta.count({
          where: { clienteLogoPath: pasta.clienteLogoPath, id: { not: params.id } },
        })
      : 0;
    const logoParaRemover = pasta.clienteLogoPath && logoDeOutraPasta === 0 ? pasta.clienteLogoPath : null;

    // Falha ao apagar arquivo derruba a exclusão inteira, de propósito: melhor a
    // pasta continuar de pé do que a linha sumir e o arquivo ficar órfão.
    await Promise.all([
      ...Array.from(outputPaths).map((outputPath) => deleteGeneratedDocx(outputPath)),
      ...Array.from(uploadPaths).map((uploadPath) => deleteUploadedFile(uploadPath)),
      ...(logoParaRemover ? [deleteLogoFile(logoParaRemover)] : []),
    ]);
    await prisma.pasta.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir pasta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
