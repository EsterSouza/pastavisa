import fs from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { dataAcesso } from "./referencias";
import type { Planejamento, ReferenciaPlanejada } from "./tipos";

// Monta o DOCX do planejamento sobre o modelo-base: o pacote do planejamento mais
// recente da Ester (08/10/2026) com o corpo esvaziado. Cabeçalho, logo, estilos,
// margens e numeração vêm de lá; aqui só se escreve o corpo, o rodapé, os metadados
// e os links. Os estilos usados são os dela: Ttulo, Ttulo1, DocItem, Ref e TableText.

const MODELO = "assets/planejamento/modelo-planejamento.docx";

/** Lista numerada "1." do modelo; cada lista ganha um w:num próprio para recomeçar do 1. */
const ABSTRACT_NUM_LISTA = 35;

/** Largura útil da seção do modelo: 12240 - 1699 - 1138 (twips). */
const LARGURA_UTIL = 9403;

const FONTE =
  '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>';
const RPR_12 = `<w:rPr>${FONTE}<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr>`;
const RPR_12_NEGRITO = `<w:rPr>${FONTE}<w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr>`;
const RPR_11 = `<w:rPr>${FONTE}<w:sz w:val="22"/><w:lang w:val="pt-BR"/></w:rPr>`;
const RPR_11_NEGRITO = `<w:rPr>${FONTE}<w:b/><w:sz w:val="22"/><w:lang w:val="pt-BR"/></w:rPr>`;
const RPR_11_ITALICO = `<w:rPr>${FONTE}<w:i/><w:sz w:val="22"/><w:lang w:val="pt-BR"/></w:rPr>`;
const RPR_11_LINK = `<w:rPr>${FONTE}<w:color w:val="245782"/><w:sz w:val="22"/><w:u w:val="single"/><w:lang w:val="pt-BR"/></w:rPr>`;
const RPR_CABECALHO_TABELA = `<w:rPr>${FONTE}<w:b/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:lang w:val="pt-BR"/></w:rPr>`;
const RPR_AVISO = `<w:rPr>${FONTE}<w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/><w:highlight w:val="yellow"/><w:lang w:val="pt-BR"/></w:rPr>`;

export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function corrida(texto: string, rPr: string): string {
  if (!texto) return "";
  return texto
    .split("\n")
    .map((linha, i) => `<w:r>${rPr}${i > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${escaparXml(linha)}</w:t></w:r>`)
    .join("");
}

function paragrafo(conteudo: string, pPrExtra = "", rPrParagrafo = RPR_12): string {
  return `<w:p><w:pPr>${pPrExtra}${rPrParagrafo}</w:pPr>${conteudo}</w:p>`;
}

const vazio = () => paragrafo("");

const titulo = (texto: string) =>
  paragrafo(corrida(texto, RPR_11), '<w:pStyle w:val="Ttulo"/><w:jc w:val="center"/>', RPR_11);

const titulo1 = (texto: string) => paragrafo(corrida(texto, RPR_12), '<w:pStyle w:val="Ttulo1"/>');

const corpo = (texto: string) =>
  paragrafo(corrida(texto, RPR_12), '<w:ind w:firstLine="720"/><w:jc w:val="both"/>');

const campo = (rotulo: string, valor: string) =>
  paragrafo(
    corrida(`${rotulo}: `, RPR_12_NEGRITO) + corrida(valor, RPR_12),
    '<w:pStyle w:val="DocItem"/>'
  );

/**
 * Texto da referência na NBR 6023: o destaque (epígrafe do ato, título ou periódico)
 * em negrito; "et al." e "In:" em itálico.
 */
function textoAbnt(texto: string, destaque?: string): string {
  const partes: Array<{ t: string; rPr: string }> = [];
  const inicio = destaque ? texto.indexOf(destaque) : -1;
  const trechos =
    inicio >= 0
      ? [
          { t: texto.slice(0, inicio), rPr: RPR_11 },
          { t: destaque!, rPr: RPR_11_NEGRITO },
          { t: texto.slice(inicio + destaque!.length), rPr: RPR_11 },
        ]
      : [{ t: texto, rPr: RPR_11 }];
  for (const trecho of trechos) {
    if (trecho.rPr !== RPR_11) {
      partes.push(trecho);
      continue;
    }
    for (const pedaco of trecho.t.split(/(et al\.|In:)/)) {
      if (pedaco) partes.push({ t: pedaco, rPr: /^(et al\.|In:)$/.test(pedaco) ? RPR_11_ITALICO : RPR_11 });
    }
  }
  return partes.map((p) => corrida(p.t, p.rPr)).join("");
}

class Montagem {
  private partes: string[] = [];
  private proximoNum: number;
  readonly nums: number[] = [];
  readonly links: Array<{ id: string; url: string }> = [];

  constructor(primeiroNum: number) {
    this.proximoNum = primeiroNum;
  }

  add(...xml: string[]) {
    this.partes.push(...xml);
  }

  lista(itens: string[]) {
    const numId = this.proximoNum++;
    this.nums.push(numId);
    for (const item of itens) {
      this.add(
        paragrafo(
          corrida(item, RPR_12),
          `<w:pStyle w:val="DocItem"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`
        )
      );
    }
  }

  referencia(ref: ReferenciaPlanejada, acessoEm?: string) {
    const texto = ref.texto.trim().replace(/[.]?$/, ".");
    let conteudo = textoAbnt(texto, ref.destaque);
    if (ref.url) {
      const id = `rIdPlan${this.links.length + 1}`;
      this.links.push({ id, url: ref.url });
      conteudo +=
        corrida(" Disponível em: ", RPR_11) +
        `<w:hyperlink r:id="${id}">${corrida(ref.url, RPR_11_LINK)}</w:hyperlink>` +
        corrida(acessoEm ? `. Acesso em: ${dataAcesso(acessoEm)}.` : ".", RPR_11);
    }
    this.add(paragrafo(conteudo, '<w:pStyle w:val="Ref"/>', RPR_11));
  }

  /** Larguras em fração de 5000, como no modelo; o grid em twips fecha com a largura útil. */
  tabela(colunas: Array<{ titulo: string; largura: number }>, linhas: string[][]) {
    const total = colunas.reduce((s, c) => s + c.largura, 0);
    const pct = colunas.map((c) => Math.round((c.largura / total) * 5000));
    pct[pct.length - 1] += 5000 - pct.reduce((s, p) => s + p, 0);
    const grid = pct.map((p) => Math.floor((p / 5000) * (LARGURA_UTIL - 10)));

    const borda = (lado: string) => `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="B9C7D1"/>`;
    const celula = (texto: string, i: number, cabecalho: boolean, manterComProxima: boolean) => {
      const rPr = cabecalho ? RPR_CABECALHO_TABELA : RPR_11;
      const fundo = cabecalho ? '<w:shd w:val="clear" w:color="auto" w:fill="245782"/>' : "";
      return (
        `<w:tc><w:tcPr><w:tcW w:w="${pct[i]}" w:type="pct"/>${fundo}<w:vAlign w:val="center"/></w:tcPr>` +
        paragrafo(
          corrida(texto, rPr),
          `<w:pStyle w:val="TableText"/>${manterComProxima ? "<w:keepNext/>" : ""}<w:spacing w:after="0"/>`,
          rPr
        ) +
        `</w:tc>`
      );
    };
    const linha = (celulas: string[], cabecalho: boolean, ultima: boolean) =>
      `<w:tr><w:trPr><w:cantSplit/>${cabecalho ? "<w:tblHeader/>" : ""}</w:trPr>` +
      celulas.map((c, i) => celula(c, i, cabecalho, !ultima)).join("") +
      `</w:tr>`;

    this.add(
      `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>` +
        ["top", "left", "bottom", "right", "insideH", "insideV"].map(borda).join("") +
        `</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="65" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="65" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar>` +
        `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
        `<w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>` +
        linha(
          colunas.map((c) => c.titulo),
          true,
          linhas.length === 0
        ) +
        linhas.map((l, i) => linha(l, false, i === linhas.length - 1)).join("") +
        `</w:tbl>`
    );
  }

  xml(): string {
    return this.partes.join("");
  }
}

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

/** Corpo do documento, na ordem dos planejamentos dela. Bloco vazio não aparece. */
export function montarCorpo(plano: Planejamento, primeiroNum: number) {
  const m = new Montagem(primeiroNum);
  const nomeMaiusculo = plano.nomeCliente.toLocaleUpperCase("pt-BR");

  m.add(titulo("DOCUMENTOS EM ELABORAÇÃO"), corpo(plano.introducao));
  for (const c of plano.cronograma) m.add(campo(c.rotulo, c.valor));
  m.add(vazio());
  for (const c of plano.identificacao) m.add(campo(c.rotulo, c.valor));

  if (plano.estruturaFisica.some((p) => p.trim())) {
    m.add(titulo1("ESTRUTURA FÍSICA INFORMADA"));
    for (const p of plano.estruturaFisica.filter((p) => p.trim())) m.add(corpo(p));
  }
  if (plano.terceirizados.length) {
    m.add(titulo1("SERVIÇOS TERCEIRIZADOS INFORMADOS"));
    for (const c of plano.terceirizados) m.add(campo(c.rotulo, c.valor));
  }
  if (plano.procedimentos.length) {
    m.add(titulo1("RELAÇÃO GERAL DE SERVIÇOS E PROCEDIMENTOS INFORMADOS"));
    m.lista(plano.procedimentos);
  }

  plano.secoes
    .filter((s) => s.itens.length)
    .forEach((secao, i) => {
      m.add(titulo1(`${ROMANOS[i] ?? i + 1}. ${secao.titulo}`));
      m.lista(secao.itens);
    });

  if (plano.avisoPrazo) {
    m.add(
      paragrafo(
        corrida("PRAZO DE CONFECÇÃO: ATÉ 15 DIAS ÚTEIS\nVocê só verá os documentos no período de apreciação", RPR_AVISO),
        '<w:pStyle w:val="DocItem"/><w:jc w:val="center"/>',
        RPR_AVISO
      )
    );
  }

  let numeroTabela = 0;
  const tituloTabela = (nome: string) => m.add(titulo1(`TABELA ${++numeroTabela} - ${nome} - ${nomeMaiusculo}`));

  if (plano.equipamentos.length) {
    tituloTabela("EQUIPAMENTOS INFORMADOS");
    m.tabela(
      [
        { titulo: "ID", largura: 330 },
        { titulo: "Equipamento informado", largura: 1450 },
        { titulo: "Marca ou fabricante", largura: 950 },
        { titulo: "Nº de série", largura: 1250 },
        { titulo: "Registro Anvisa", largura: 1020 },
      ],
      plano.equipamentos.map((e) => [e.id, e.nome, e.marca, e.serie, e.registroAnvisa])
    );
    m.add(vazio());
  }

  if (plano.insumos.length) {
    tituloTabela("INSUMOS, PRODUTOS E MATERIAIS INFORMADOS");
    const comMarca = plano.insumos.some((i) => i.marca.trim());
    m.tabela(
      [
        { titulo: "ID", largura: 372 },
        { titulo: "Insumo, produto ou material informado", largura: comMarca ? 2900 : 4628 },
        ...(comMarca ? [{ titulo: "Marca ou linha informada", largura: 1728 }] : []),
      ],
      plano.insumos.map((i) => (comMarca ? [i.id, i.nome, i.marca] : [i.id, i.nome]))
    );
    m.add(vazio());
  }

  if (plano.matriz.length) {
    const comInsumos = plano.insumos.length > 0;
    tituloTabela(comInsumos ? "PROCEDIMENTOS × EQUIPAMENTOS × INSUMOS" : "PROCEDIMENTOS × EQUIPAMENTOS");
    m.tabela(
      [
        { titulo: "ID", largura: 372 },
        { titulo: "Procedimento informado", largura: comInsumos ? 2300 : 2900 },
        { titulo: "Equipamento vinculado", largura: comInsumos ? 1328 : 1728 },
        ...(comInsumos ? [{ titulo: "Insumos vinculados", largura: 1000 }] : []),
      ],
      plano.matriz.map((l) =>
        comInsumos ? [l.id, l.procedimento, l.equipamentos, l.insumos ?? ""] : [l.id, l.procedimento, l.equipamentos]
      )
    );
  }

  const grupos = plano.referencias.filter((g) => g.itens.length);
  if (grupos.length) {
    m.add(titulo1("LEGISLAÇÃO E REFERÊNCIAS APLICÁVEIS AO ESTABELECIMENTO"));
    grupos.forEach((grupo, i) => {
      m.add(titulo1(`${i + 1}. ${grupo.titulo}`));
      for (const ref of grupo.itens) m.referencia(ref, plano.acessoEm || undefined);
    });
    m.add(vazio());
  }

  if (plano.cnaes.length) {
    tituloTabela("ATIVIDADES ECONÔMICAS VINCULADAS AO CNPJ");
    m.tabela(
      [
        { titulo: "Tipo", largura: 800 },
        { titulo: "Código CNAE", largura: 900 },
        { titulo: "Descrição da atividade", largura: 3300 },
      ],
      plano.cnaes.map((c) => [c.tipo, c.codigo, c.descricao])
    );
    m.add(vazio());
  }

  return m;
}

function maiorNumId(numbering: string): number {
  let maior = 0;
  for (const match of Array.from(numbering.matchAll(/<w:num w:numId="(\d+)"/g))) {
    maior = Math.max(maior, Number(match[1]));
  }
  return maior;
}

export function nomeArquivoPlanejamento(plano: Pick<Planejamento, "nomeCliente">): string {
  const nome = plano.nomeCliente.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `Documentos em elaboração - ${nome.toLocaleUpperCase("pt-BR")}.docx`;
}

export async function gerarDocxPlanejamento(plano: Planejamento, agora = new Date()): Promise<Buffer> {
  const zip = new PizZip(await fs.readFile(path.join(process.cwd(), MODELO)));
  const ler = (nome: string) => {
    const arquivo = zip.file(nome);
    if (!arquivo) throw new Error(`Modelo do planejamento sem ${nome}`);
    return arquivo.asText();
  };

  let numbering = ler("word/numbering.xml");
  const montagem = montarCorpo(plano, maiorNumId(numbering) + 1);

  // Corpo: tudo entre <w:body> e a sectPr final, que guarda margens, cabeçalho e rodapé.
  const documento = ler("word/document.xml");
  const inicio = documento.indexOf("<w:body>") + "<w:body>".length;
  const sectPr = documento.lastIndexOf("<w:sectPr");
  zip.file("word/document.xml", documento.slice(0, inicio) + montagem.xml() + documento.slice(sectPr));

  const nums = montagem.nums
    .map(
      (id) =>
        `<w:num w:numId="${id}"><w:abstractNumId w:val="${ABSTRACT_NUM_LISTA}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`
    )
    .join("");
  // w:num vem depois de todos os w:abstractNum; antes do numIdMacAtCleanup, se houver.
  const fimNums = numbering.search(/<w:numIdMacAtCleanup|<\/w:numbering>/);
  numbering = numbering.slice(0, fimNums) + nums + numbering.slice(fimNums);
  zip.file("word/numbering.xml", numbering);

  const rels = ler("word/_rels/document.xml.rels");
  const novosRels = montagem.links
    .map(
      (l) =>
        `<Relationship Id="${l.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escaparXml(l.url)}" TargetMode="External"/>`
    )
    .join("");
  zip.file("word/_rels/document.xml.rels", rels.replace("</Relationships>", `${novosRels}</Relationships>`));

  const rodape = escaparXml(
    `Planejamento da Pasta Sanitária - ${plano.nomeCliente}${plano.cidadeUf ? ` | ${plano.cidadeUf}` : ""}`
  );
  for (const nome of Object.keys(zip.files).filter((n) => /^word\/footer\d*\.xml$/.test(n))) {
    zip.file(nome, ler(nome).split("{{RODAPE}}").join(rodape));
  }

  const nomeMaiusculo = plano.nomeCliente.toLocaleUpperCase("pt-BR");
  const core = ler("docProps/core.xml")
    .replace("{{TITULO}}", escaparXml(`Documentos em elaboração - ${nomeMaiusculo}`))
    .replace("{{ASSUNTO}}", rodape)
    .replace("{{PALAVRAS}}", escaparXml(["Pasta Sanitária", plano.nomeCliente, plano.cidadeUf].filter(Boolean).join("; ")))
    .split("{{DATA}}")
    .join(agora.toISOString().replace(/\.\d{3}Z$/, "Z"));
  zip.file("docProps/core.xml", core);

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
