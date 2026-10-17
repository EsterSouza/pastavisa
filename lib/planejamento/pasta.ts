import { UF_OPTIONS, toUF } from "@visa/legislacao";
import type { ClienteData } from "@/lib/ai";
import { complementarClienteComTextoElaboracao } from "@/lib/client-data-fallback";
import { inferirTipoDocumento } from "@/lib/document-list-extractor";
import type { DocSelecionado } from "@/lib/pasta-criar";
import type { Planejamento } from "./tipos";

// Dados da pasta tirados do próprio planejamento, sem IA: o que a criação pelo
// Forms + DOCX gasta uma leitura de IA para descobrir, aqui já está estruturado.

const CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;

function campo(plano: Planejamento, rotulo: RegExp): string {
  return plano.identificacao.find((c) => rotulo.test(c.rotulo))?.valor.trim() || "";
}

/** "Nome, profissão, conselho nº 123" em partes; sem vírgula, tudo é o nome. */
function responsavel(valor: string) {
  const [nome = "", profissao = "", ...resto] = valor.split(",").map((p) => p.trim());
  return { nome, profissao, conselho: resto.join(", ") };
}

function empresaECnpj(valor: string) {
  const cnpj = valor.match(CNPJ)?.[0] || "";
  const razao = (cnpj ? valor.slice(0, valor.indexOf(cnpj)) : valor).replace(/[,;\s]*(CNPJ:?)?\s*$/i, "").trim();
  return { razao, cnpj };
}

export function clienteDoPlanejamento(plano: Planejamento, textoDocx: string): ClienteData {
  // Rótulos simples (CNPJ, telefone, e-mail, horário) pelo mesmo leitor do fluxo antigo.
  const base = complementarClienteComTextoElaboracao({}, textoDocx);

  const [cidade = "", ufTexto = ""] = plano.cidadeUf.split("/").map((p) => p.trim());
  const uf = toUF(ufTexto);
  const rt = responsavel(campo(plano, /respons[aá]vel t[eé]cnic/i));

  const terceirizados = plano.terceirizados
    .filter((t) => t.valor.trim() && !/^n[aã]o\b/i.test(t.valor.trim()))
    .map((t) => {
      const { razao, cnpj } = empresaECnpj(t.valor);
      return { servico: t.rotulo, razao_social: razao, cnpj };
    });
  const coleta =
    terceirizados.find((t) => /res[ií]duos de servi[cç]os de sa[uú]de/i.test(t.servico)) ||
    terceirizados.find((t) => /ambienta|res[ií]duo|coleta/i.test(t.razao_social));

  const usoDoInsumo = (id: string) =>
    plano.matriz
      .filter((m) => (m.insumos || "").split(/[,;\s]+/).includes(id))
      .map((m) => m.procedimento)
      .join("; ");

  return {
    ...base,
    clienteNomeFantasia: campo(plano, /nome fantasia/i) || base.clienteNomeFantasia || plano.nomeCliente,
    clienteRazaoSocial: campo(plano, /raz[aã]o social/i) || base.clienteRazaoSocial,
    clienteCidade: cidade || base.clienteCidade,
    clienteEstado: uf || base.clienteEstado,
    clienteEstadoExtenso: UF_OPTIONS.find((o) => o.uf === uf)?.name || base.clienteEstadoExtenso,
    clienteProprietarioNome: campo(plano, /titular/i) || base.clienteProprietarioNome,
    clienteRtNome: rt.nome || base.clienteRtNome,
    clienteRtProfissao: rt.profissao || base.clienteRtProfissao,
    clienteRtConselho: rt.conselho || base.clienteRtConselho,
    clienteResponsaveisTecnicos: rt.nome
      ? [{ nome: rt.nome, profissao: rt.profissao, conselho: rt.conselho, setor: "Responsabilidade técnica" }]
      : base.clienteResponsaveisTecnicos,
    clienteEstrutura: plano.estruturaFisica.join("\n"),
    clienteServicos: plano.procedimentos.map((p) => p.trim()).filter(Boolean),
    clienteEquipamentos: plano.equipamentos.map((e) => ({
      nome: e.nome,
      marca: e.marca,
      modelo: "",
      registro_anvisa: e.registroAnvisa,
    })),
    clienteProdutosInsumos: plano.insumos.map((i) => ({
      nome: i.nome,
      categoria: "",
      fabricante: i.marca,
      registro_anvisa: "",
      uso: usoDoInsumo(i.id),
    })),
    clienteTerceirizados: terceirizados,
    clienteColetaRazao: coleta?.razao_social || "",
    clienteColetaCnpj: coleta?.cnpj || "",
  };
}

/** A lista de documentos do planejamento, na ordem das seções, com o template que o rascunho escolheu. */
export function documentosDoPlanejamento(plano: Planejamento, templates: Record<string, string> = {}): DocSelecionado[] {
  const vistos = new Set<string>();
  return plano.secoes
    .flatMap((s) => s.itens)
    .map((nome) => nome.trim())
    .filter((nome) => nome && !vistos.has(nome) && vistos.add(nome))
    .map((nome) => ({ nome, tipo: inferirTipoDocumento(nome), template: templates[nome] || undefined }));
}
