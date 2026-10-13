import { calcularPrazos, dataBr } from "./prazos";
import { aplicarRegras } from "./regras";
import type { Pendencia, RascunhoIa, TemplateCatalogo } from "./ia";
import type { Planejamento } from "./tipos";

// Junta o rascunho da IA com o que a Ester escolhe na tela (data, versão da pasta,
// plataforma, cor da logo) e com as regras fixas. As referências entram depois.

export interface OpcoesPlanejamento {
  /** ISO AAAA-MM-DD. */
  dataPlanejamento: string;
  versaoPasta: string;
  plataforma: string;
  corLogo: string;
}

export interface ItemRevisao {
  secao: string;
  nome: string;
  /** Nome do template do acervo que sustenta o item; vazio = sem template. */
  template: string;
}

export interface ResultadoRascunho {
  planejamento: Planejamento;
  /** Para a tela: de que template veio cada documento. */
  itens: ItemRevisao[];
  pendencias: Pendencia[];
  profissoes: string[];
  avisoFormulario: string;
}

export function montarPlanejamento(
  rascunho: RascunhoIa,
  opcoes: OpcoesPlanejamento,
  templates: TemplateCatalogo[]
): ResultadoRascunho {
  const porId = new Map(templates.map((t) => [t.id, t]));
  const pendencias = [...(rascunho.pendencias || [])];
  const itens: ItemRevisao[] = [];

  for (const secao of rascunho.secoes || []) {
    for (const item of secao.itens || []) {
      const template = item.template ? porId.get(item.template) : undefined;
      if (item.template && !template) {
        pendencias.push({ assunto: item.nome, detalhe: "A IA citou um template que não existe no acervo.", para: "ester" });
      }
      itens.push({ secao: secao.titulo, nome: item.nome, template: template?.nome || "" });
    }
  }

  const { secoes, removidos } = aplicarRegras(
    (rascunho.secoes || []).map((s) => ({ titulo: s.titulo, itens: (s.itens || []).map((i) => i.nome) })),
    rascunho.servicoDeSaude
  );
  for (const nome of removidos) {
    pendencias.push({ assunto: nome, detalhe: "Tirado do planejamento: está na lista do que nunca entra.", para: "ester" });
  }

  const prazos = calcularPrazos(opcoes.dataPlanejamento);
  const cidadeUf = [rascunho.cidade, rascunho.uf].filter(Boolean).join("/");

  const planejamento: Planejamento = {
    nomeCliente: rascunho.nomeCliente,
    cidadeUf,
    introducao: rascunho.introducao,
    cronograma: [
      { rotulo: "Data deste planejamento", valor: dataBr(prazos.dataPlanejamento) },
      {
        rotulo: "Período de apreciação",
        valor: `${dataBr(prazos.apreciacaoInicio)} a ${dataBr(prazos.apreciacaoFim)}`,
      },
      { rotulo: "Período para entrega final e gráfica", valor: dataBr(prazos.entregaFinal) },
      { rotulo: "Status", valor: "em fase de estruturação e levantamento técnico" },
    ],
    identificacao: [
      { rotulo: "Versão da Pasta", valor: opcoes.versaoPasta },
      { rotulo: "Plataforma de entrega da Pasta Digital", valor: opcoes.plataforma },
      { rotulo: "Cor de fundo da logomarca", valor: opcoes.corLogo },
      ...(rascunho.identificacao || []).filter(
        (c) => !/^(vers[aã]o da pasta|plataforma|cor de fundo)/i.test(c.rotulo.trim())
      ),
    ],
    estruturaFisica: rascunho.estruturaFisica || [],
    terceirizados: rascunho.terceirizados || [],
    procedimentos: rascunho.procedimentos || [],
    secoes,
    avisoPrazo: true,
    equipamentos: rascunho.equipamentos || [],
    insumos: rascunho.insumos || [],
    matriz: rascunho.matriz || [],
    referencias: [],
    cnaes: rascunho.cnaes || [],
  };

  return {
    planejamento,
    itens,
    pendencias,
    profissoes: rascunho.profissoes || [],
    avisoFormulario: rascunho.formularioIntegro === false ? rascunho.avisoFormulario || "Formulário cortado ou ilegível." : "",
  };
}
