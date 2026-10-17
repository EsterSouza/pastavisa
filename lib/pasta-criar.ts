import { prisma } from "@/lib/prisma";
import type { ClienteData } from "@/lib/ai";
import { findBestTemplateMatch } from "@/lib/template-matcher";
import { lerPrazosDaPasta } from "@/lib/elaboracao-prazos";

// Gravação da pasta nova, comum à criação pelo Forms + DOCX (/api/extrair/confirmar)
// e à criação direto do planejamento (/api/planejamento/criar-pasta).

export interface DocSelecionado {
  nome: string;
  tipo: string;
  /** Nome do template já escolhido (no planejamento); sem ele, vale a semelhança de nome. */
  template?: string;
}

export interface NovaPasta {
  pdfPath?: string | null;
  docxPath?: string | null;
  data: ClienteData;
  documentosSelecionados: DocSelecionado[];
  legislacaoIds?: string[];
}

export async function criarPasta({ pdfPath, docxPath, data, documentosSelecionados, legislacaoIds }: NovaPasta): Promise<string> {
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
      clienteProprietarioNome: data.clienteProprietarioNome,
      clienteRtNome: data.clienteRtNome,
      clienteRtProfissao: data.clienteRtProfissao,
      clienteRtConselho: data.clienteRtConselho,
      clienteResponsaveisTecnicos: JSON.stringify(data.clienteResponsaveisTecnicos || []),
      clienteEstrutura: data.clienteEstrutura,
      clienteMemorialDescritivoMbp: data.clienteMemorialDescritivoMbp,
      clienteServicos: JSON.stringify(data.clienteServicos || []),
      clienteFuncionarios: JSON.stringify(data.clienteFuncionarios || []),
      clienteEquipamentos: JSON.stringify(data.clienteEquipamentos || []),
      clienteProdutosInsumos: JSON.stringify(data.clienteProdutosInsumos || []),
      clienteTerceirizados: JSON.stringify(data.clienteTerceirizados || []),
      clienteColetaRazao: data.clienteColetaRazao,
      clienteColetaCnpj: data.clienteColetaCnpj,
      clienteResiduosA: data.clienteResiduosA,
      clienteResiduosD: data.clienteResiduosD,
      clienteResiduosE: data.clienteResiduosE,
      formsPdfPath: pdfPath || null,
      documentosElaboracaoPath: docxPath || null,
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
        const escolhido = doc.template ? templates.find((t) => t.nome === doc.template) : undefined;
        return {
          pastaId: pasta.id,
          nomeArquivo: doc.nome,
          status: "pendente",
          templateId: escolhido?.id ?? findBestTemplateMatch(doc.nome, templates)?.templateId,
        };
      }),
    });
  }

  // A pasta já existe: um erro aqui só deixa os prazos para a lista ler depois.
  await lerPrazosDaPasta(pasta.id).catch((error) => console.warn("[criar pasta] prazos não lidos:", error));

  return pasta.id;
}
