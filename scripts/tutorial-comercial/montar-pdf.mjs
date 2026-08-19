// Monta o PDF do tutorial do planner para o time comercial, com as telas reais
// capturadas em produção e as marcações desenhadas por cima, na coordenada exata que
// o navegador reportou para cada campo.

import { PDFDocument, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TELAS = process.argv[2];
const DESTINO = process.argv[3];

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 46;
const GUTTER = 30; // faixa à esquerda da imagem, onde ficam os números e as setas
const LARGURA_TEXTO = A4.largura - MARGEM * 2;

const NAVY_FUNDO = rgb(7 / 255, 24 / 255, 46 / 255);
const NAVY = rgb(11 / 255, 31 / 255, 58 / 255);
const ACAO = rgb(36 / 255, 74 / 255, 155 / 255);
const PALE = rgb(234 / 255, 243 / 255, 252 / 255);
const AMBAR = rgb(217 / 255, 151 / 255, 33 / 255);
const AMBAR_PALE = rgb(253 / 255, 246 / 255, 227 / 255);
const BORDA = rgb(206 / 255, 224 / 255, 243 / 255);
const CINZA = rgb(57 / 255, 82 / 255, 114 / 255);
const BRANCO = rgb(1, 1, 1);
const VERDE = rgb(22 / 255, 122 / 255, 90 / 255);
const VERDE_PALE = rgb(233 / 255, 247 / 255, 242 / 255);
const VERMELHO = rgb(176 / 255, 42 / 255, 42 / 255);

const capturas = new Map();
for (const arquivo of ["capturas.json", "capturas-2.json"]) {
  for (const captura of JSON.parse(readFileSync(join(TELAS, arquivo), "utf8"))) {
    capturas.set(captura.id, captura);
  }
}

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);

const fontes = {
  display: await doc.embedFont(readFileSync("public/brand/fonts/Sora-SemiBold.ttf"), { subset: true }),
  displayLeve: await doc.embedFont(readFileSync("public/brand/fonts/Sora-Medium.ttf"), { subset: true }),
  corpo: await doc.embedFont(readFileSync("public/brand/fonts/SourceSans3-Regular.ttf"), { subset: true }),
  corpoForte: await doc.embedFont(readFileSync("public/brand/fonts/SourceSans3-SemiBold.ttf"), { subset: true }),
};
const logo = await doc.embedPng(readFileSync("public/brand/treinavisa-logo-print.png"));

let pagina;
let y;

function novaPagina() {
  pagina = doc.addPage([A4.largura, A4.altura]);
  y = A4.altura - MARGEM;
  return pagina;
}

function quebrar(texto, fonte, tamanho, largura) {
  const linhas = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(" ")) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(teste, tamanho) > largura && atual) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = teste;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

function texto(conteudo, opcoes = {}) {
  const {
    fonte = fontes.corpo,
    tamanho = 10.5,
    cor = NAVY,
    x = MARGEM,
    largura = LARGURA_TEXTO,
    entrelinha = 1.42,
    gap = 6,
  } = opcoes;

  for (const linha of quebrar(conteudo, fonte, tamanho, largura)) {
    y -= tamanho * entrelinha;
    pagina.drawText(linha, { x, y, size: tamanho, font: fonte, color: cor });
  }
  y -= gap;
}

function titulo(conteudo, opcoes = {}) {
  const { tamanho = 19, cor = NAVY, gap = 10 } = opcoes;
  y -= tamanho;
  pagina.drawText(conteudo, { x: MARGEM, y, size: tamanho, font: fontes.display, color: cor });
  y -= gap;
}

function faixaEtapa(numero, rotulo) {
  const alturaFaixa = 30;
  y -= alturaFaixa;
  pagina.drawRectangle({ x: MARGEM, y, width: LARGURA_TEXTO, height: alturaFaixa, color: PALE });
  pagina.drawRectangle({ x: MARGEM, y, width: 4, height: alturaFaixa, color: ACAO });
  pagina.drawCircle({ x: MARGEM + 24, y: y + alturaFaixa / 2, size: 10, color: ACAO });
  const n = String(numero);
  pagina.drawText(n, {
    x: MARGEM + 24 - fontes.corpoForte.widthOfTextAtSize(n, 10) / 2,
    y: y + alturaFaixa / 2 - 3.5,
    size: 10,
    font: fontes.corpoForte,
    color: BRANCO,
  });
  pagina.drawText(rotulo, {
    x: MARGEM + 44,
    y: y + alturaFaixa / 2 - 4.5,
    size: 12,
    font: fontes.display,
    color: NAVY,
  });
  y -= 14;
}

function cabecalho(rotulo) {
  pagina.drawRectangle({ x: 0, y: A4.altura - 26, width: A4.largura, height: 26, color: PALE });
  pagina.drawText("Pasta Sanitária — pré-planejamento comercial", {
    x: MARGEM,
    y: A4.altura - 17.5,
    size: 8,
    font: fontes.corpoForte,
    color: ACAO,
  });
  const largura = fontes.corpo.widthOfTextAtSize(rotulo, 8);
  pagina.drawText(rotulo, {
    x: A4.largura - MARGEM - largura,
    y: A4.altura - 17.5,
    size: 8,
    font: fontes.corpo,
    color: CINZA,
  });
  y = A4.altura - 26 - 22;
}

function seta(x1, y1, x2, y2, cor = ACAO) {
  pagina.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.4, color: cor });
  const angulo = Math.atan2(y2 - y1, x2 - x1);
  const tamanho = 5.5;
  const pontos = [
    [x2, y2],
    [x2 - tamanho * Math.cos(angulo - Math.PI / 7), y2 - tamanho * Math.sin(angulo - Math.PI / 7)],
    [x2 - tamanho * Math.cos(angulo + Math.PI / 7), y2 - tamanho * Math.sin(angulo + Math.PI / 7)],
  ];
  pagina.drawSvgPath(`M ${pontos[0][0]} ${-pontos[0][1]} L ${pontos[1][0]} ${-pontos[1][1]} L ${pontos[2][0]} ${-pontos[2][1]} Z`, {
    color: cor,
    borderWidth: 0,
  });
}

function selo(numero, cx, cy, cor = ACAO) {
  // Halo branco: o número às vezes cai sobre a tela, e sem ele se mistura ao conteúdo.
  pagina.drawCircle({ x: cx, y: cy, size: 11, color: BRANCO });
  pagina.drawCircle({ x: cx, y: cy, size: 9, color: cor });
  const n = String(numero);
  pagina.drawText(n, {
    x: cx - fontes.corpoForte.widthOfTextAtSize(n, 9.5) / 2,
    y: cy - 3.3,
    size: 9.5,
    font: fontes.corpoForte,
    color: BRANCO,
  });
}

/**
 * Desenha a tela e, sobre ela, um retângulo em volta de cada alvo com o número
 * correspondente à lista de baixo. As coordenadas vêm do navegador, então a marcação
 * cai no campo certo mesmo que a tela mude de altura.
 */
async function tela(id, itens, opcoes = {}) {
  const captura = capturas.get(id);
  if (!captura) throw new Error(`captura ausente: ${id}`);

  const recorteY = opcoes.de ?? 0;
  const recorteAte = Math.min(opcoes.ate ?? captura.altura, captura.altura);
  const alturaRecorte = recorteAte - recorteY;

  const origem = sharp(join(TELAS, captura.arquivo));
  const meta = await origem.metadata();
  const escalaPng = meta.width / captura.largura;
  const buffer = await sharp(join(TELAS, captura.arquivo))
    .extract({
      left: 0,
      top: Math.round(recorteY * escalaPng),
      width: meta.width,
      height: Math.round(alturaRecorte * escalaPng),
    })
    .png()
    .toBuffer();

  const imagem = await doc.embedPng(buffer);
  y -= 12;
  const larguraImagem = LARGURA_TEXTO - GUTTER;
  const escala = larguraImagem / captura.largura;
  const alturaImagem = alturaRecorte * escala;
  const x0 = MARGEM + GUTTER;
  const topo = y;
  const y0 = topo - alturaImagem;

  if (y0 < MARGEM + 14) {
    throw new Error(`a tela ${id} não cabe na página: sobra ${(y0 - MARGEM).toFixed(0)}pt`);
  }

  pagina.drawImage(imagem, { x: x0, y: y0, width: larguraImagem, height: alturaImagem });
  pagina.drawRectangle({
    x: x0,
    y: y0,
    width: larguraImagem,
    height: alturaImagem,
    borderColor: BORDA,
    borderWidth: 0.8,
  });

  itens.forEach((item, indice) => {
    const alvo = captura.alvos[item.alvo];
    if (!alvo) return;
    const cor = item.cor ?? ACAO;
    const caixaX = x0 + alvo.x * escala;
    const caixaTopo = topo - (alvo.y - recorteY) * escala;
    const caixaAltura = alvo.h * escala;
    const caixaLargura = Math.min(alvo.w * escala, larguraImagem - alvo.x * escala);

    pagina.drawRectangle({
      x: caixaX - 2,
      y: caixaTopo - caixaAltura - 2,
      width: caixaLargura + 4,
      height: caixaAltura + 4,
      borderColor: cor,
      borderWidth: 1.4,
    });

    // O número fica na faixa da esquerda quando o campo é rente à borda, e colado no
    // próprio campo quando ele está no meio ou à direita: seta longa atravessando o
    // cartão risca o conteúdo em vez de apontar para ele.
    const centro = caixaTopo - caixaAltura / 2;
    const distante = caixaX - x0 > 40;
    const cx = distante ? caixaX - 14 : MARGEM + 12;
    selo(indice + 1, cx, centro, cor);
    if (!distante && caixaX - 12 > cx + 12) seta(cx + 11, centro, caixaX - 4, centro, cor);
  });

  y = y0 - 16;
}

function lista(itens, opcoes = {}) {
  const { tamanho = 10, gap = 7 } = opcoes;
  itens.forEach((item, indice) => {
    const cor = item.cor ?? ACAO;
    const linhas = quebrar(item.texto, fontes.corpo, tamanho, LARGURA_TEXTO - 26);
    const alturaBloco = linhas.length * tamanho * 1.38;
    selo(indice + 1, MARGEM + 9, y - 6.5, cor);
    let linhaY = y;
    for (const linha of linhas) {
      linhaY -= tamanho * 1.38;
      pagina.drawText(linha, { x: MARGEM + 26, y: linhaY, size: tamanho, font: fontes.corpo, color: NAVY });
    }
    y -= alturaBloco + gap;
  });
}

function marcadores(itens, opcoes = {}) {
  const { tamanho = 10, cor = ACAO, gap = 5 } = opcoes;
  for (const item of itens) {
    const linhas = quebrar(item, fontes.corpo, tamanho, LARGURA_TEXTO - 22);
    pagina.drawCircle({ x: MARGEM + 5, y: y - tamanho * 0.75, size: 2.2, color: cor });
    for (const linha of linhas) {
      y -= tamanho * 1.38;
      pagina.drawText(linha, { x: MARGEM + 18, y, size: tamanho, font: fontes.corpo, color: NAVY });
    }
    y -= gap;
  }
  y -= 2;
}

function aviso(titulo, corpo, cor = AMBAR, fundo = AMBAR_PALE) {
  const linhasTitulo = quebrar(titulo, fontes.corpoForte, 10.5, LARGURA_TEXTO - 28);
  const linhasCorpo = quebrar(corpo, fontes.corpo, 10, LARGURA_TEXTO - 28);
  const altura = 18 + linhasTitulo.length * 15 + linhasCorpo.length * 14;
  y -= altura;
  pagina.drawRectangle({ x: MARGEM, y, width: LARGURA_TEXTO, height: altura, color: fundo });
  pagina.drawRectangle({ x: MARGEM, y, width: 3.5, height: altura, color: cor });

  let linhaY = y + altura - 6;
  for (const linha of linhasTitulo) {
    linhaY -= 14;
    pagina.drawText(linha, { x: MARGEM + 16, y: linhaY, size: 10.5, font: fontes.corpoForte, color: cor });
  }
  for (const linha of linhasCorpo) {
    linhaY -= 13.5;
    pagina.drawText(linha, { x: MARGEM + 16, y: linhaY, size: 10, font: fontes.corpo, color: NAVY });
  }
  y -= 14;
}

function duasColunas(esquerda, direita) {
  const largura = (LARGURA_TEXTO - 16) / 2;
  const topo = y;

  function coluna(dados, x) {
    let colunaY = topo;
    const linhasTitulo = quebrar(dados.titulo, fontes.corpoForte, 10.5, largura - 24);
    const linhasItens = dados.itens.map((item) => quebrar(item, fontes.corpo, 9.5, largura - 30));
    const alturaCaixa =
      22 + linhasTitulo.length * 14 + linhasItens.reduce((soma, linhas) => soma + linhas.length * 12.5 + 6, 0);
    pagina.drawRectangle({
      x,
      y: topo - alturaCaixa,
      width: largura,
      height: alturaCaixa,
      color: dados.fundo,
      borderColor: dados.cor,
      borderWidth: 0.8,
    });
    colunaY = topo - 8;
    for (const linha of linhasTitulo) {
      colunaY -= 14;
      pagina.drawText(linha, { x: x + 12, y: colunaY, size: 10.5, font: fontes.corpoForte, color: dados.cor });
    }
    colunaY -= 4;
    for (const linhas of linhasItens) {
      if (dados.marca === "?") {
        pagina.drawText("?", { x: x + 13, y: colunaY - 10, size: 10.5, font: fontes.corpoForte, color: dados.cor });
      } else {
        // Visto desenhado: a fonte da marca não traz o caractere e ele sairia em branco.
        pagina.drawLine({ start: { x: x + 12, y: colunaY - 6.5 }, end: { x: x + 15, y: colunaY - 10 }, thickness: 1.5, color: dados.cor });
        pagina.drawLine({ start: { x: x + 15, y: colunaY - 10 }, end: { x: x + 20, y: colunaY - 2.5 }, thickness: 1.5, color: dados.cor });
      }
      for (const linha of linhas) {
        colunaY -= 12.5;
        pagina.drawText(linha, { x: x + 26, y: colunaY, size: 9.5, font: fontes.corpo, color: NAVY });
      }
      colunaY -= 6;
    }
    return alturaCaixa;
  }

  const alturaA = coluna(esquerda, MARGEM);
  const alturaB = coluna(direita, MARGEM + largura + 16);
  y = topo - Math.max(alturaA, alturaB) - 16;
}

// ---------------------------------------------------------------- capa

novaPagina();
pagina.drawRectangle({ x: 0, y: A4.altura - 300, width: A4.largura, height: 300, color: NAVY_FUNDO });
const escalaLogo = 132 / logo.width;
pagina.drawImage(logo, {
  x: MARGEM,
  y: A4.altura - 92,
  width: 132,
  height: logo.height * escalaLogo,
});
pagina.drawText("GUIA DO TIME COMERCIAL", {
  x: MARGEM,
  y: A4.altura - 150,
  size: 10,
  font: fontes.corpoForte,
  color: rgb(111 / 255, 149 / 255, 246 / 255),
});
pagina.drawText("Como usar o", { x: MARGEM, y: A4.altura - 190, size: 30, font: fontes.display, color: BRANCO });
pagina.drawText("pré-planejamento", { x: MARGEM, y: A4.altura - 226, size: 30, font: fontes.display, color: BRANCO });
pagina.drawText("comercial", { x: MARGEM, y: A4.altura - 262, size: 30, font: fontes.display, color: BRANCO });

y = A4.altura - 330;
texto(
  "Este guia mostra, tela por tela, como montar o pré-planejamento de uma cliente com ela na linha: informar a operação, conferir o que entra na pasta, comparar os formatos e baixar o PDF para enviar.",
  { tamanho: 11.5, cor: CINZA }
);

y -= 8;
const alturaLink = 54;
y -= alturaLink;
pagina.drawRectangle({ x: MARGEM, y, width: LARGURA_TEXTO, height: alturaLink, color: PALE, borderColor: BORDA, borderWidth: 0.8 });
pagina.drawText("O link do atendimento", { x: MARGEM + 16, y: y + alturaLink - 20, size: 9.5, font: fontes.corpoForte, color: ACAO });
pagina.drawText("https://pastavisa.vercel.app/planner", {
  x: MARGEM + 16,
  y: y + 14,
  size: 14,
  font: fontes.display,
  color: NAVY,
});
y -= 20;

texto("O que este link é", { fonte: fontes.display, tamanho: 13, gap: 8 });
marcadores([
  "Uma calculadora de proposta: você digita o que a cliente faz e ele devolve a lista de documentos da pasta, o preço e o prazo.",
  "Público e sem senha. Abre em qualquer navegador, no computador ou no celular, sem instalar nada.",
  "Provisório por natureza. Todo PDF que sai daqui é pré-planejamento e passa pela equipe técnica antes de virar contrato.",
]);

y -= 4;
texto("O que este link não é", { fonte: fontes.display, tamanho: 13, gap: 8 });
marcadores(
  [
    "Não é proposta assinada nem contrato. O PDF diz isso na primeira página.",
    "Não é a pasta pronta. É a previsão do que a equipe vai elaborar.",
    "Não guarda cadastro de cliente. Nada do que você digita fica salvo no sistema.",
  ],
  { cor: AMBAR }
);

pagina.drawText(`Atualizado em ${new Date().toLocaleDateString("pt-BR")}`, {
  x: MARGEM,
  y: MARGEM,
  size: 8.5,
  font: fontes.corpo,
  color: CINZA,
});

// ---------------------------------------------------------------- antes de começar

novaPagina();
cabecalho("Antes de começar");
titulo("O caminho inteiro, em quatro etapas");
texto(
  "O topo da tela mostra sempre em qual etapa você está. Dá para voltar a qualquer momento sem perder o que já foi digitado.",
  { cor: CINZA }
);

y -= 6;
const etapas = [
  ["Cliente", "Nome, município e UF."],
  ["Operação", "O que a cliente faz, com as palavras dela."],
  ["Revisão", "Confira procedimentos, documentos e avisos."],
  ["Formato e preço", "Escolha a entrega e baixe o PDF."],
];
const larguraEtapa = (LARGURA_TEXTO - 3 * 8) / 4;
const alturaEtapa = 74;
y -= alturaEtapa;
etapas.forEach(([nome, descricao], indice) => {
  const x = MARGEM + indice * (larguraEtapa + 8);
  pagina.drawRectangle({ x, y, width: larguraEtapa, height: alturaEtapa, color: PALE, borderColor: BORDA, borderWidth: 0.8 });
  pagina.drawCircle({ x: x + 18, y: y + alturaEtapa - 18, size: 9, color: ACAO });
  pagina.drawText(String(indice + 1), {
    x: x + 18 - fontes.corpoForte.widthOfTextAtSize(String(indice + 1), 9.5) / 2,
    y: y + alturaEtapa - 21.3,
    size: 9.5,
    font: fontes.corpoForte,
    color: BRANCO,
  });
  pagina.drawText(nome, { x: x + 32, y: y + alturaEtapa - 22, size: 10, font: fontes.display, color: NAVY });
  let linhaY = y + alturaEtapa - 34;
  for (const linha of quebrar(descricao, fontes.corpo, 9, larguraEtapa - 22)) {
    linhaY -= 11.5;
    pagina.drawText(linha, { x: x + 12, y: linhaY, size: 9, font: fontes.corpo, color: CINZA });
  }
  if (indice < 3) {
    seta(x + larguraEtapa + 1, y + alturaEtapa / 2, x + larguraEtapa + 7, y + alturaEtapa / 2, BORDA);
  }
});
y -= 22;

titulo("Três coisas que valem para o atendimento inteiro", { tamanho: 15 });
lista([
  {
    texto: "O preenchimento fica guardado no seu navegador por duas horas. Se a página recarregar, ou se você fechar a aba sem querer, o atendimento volta de onde parou.",
  },
  {
    texto: "Um atendimento por vez. Ao começar outra cliente, clique em “Recomeçar do zero”, no canto superior direito — senão os dados da anterior continuam ali.",
  },
  {
    texto: "Evite disparar muitas análises seguidas. O sistema segura por alguns minutos quando recebe pedidos demais do mesmo lugar; se acontecer, espere e tente de novo.",
  },
]);

y -= 4;
aviso(
  "O nome do cliente sai no PDF exatamente como você digitar",
  "Confira acentuação e o nome fantasia antes de gerar. É o nome que a cliente vai ler no documento que você enviar.",
  ACAO,
  PALE
);

// ---------------------------------------------------------------- etapa 1

novaPagina();
cabecalho("Etapa 1 de 4");
faixaEtapa(1, "Cliente e local");
texto("Só o nome é obrigatório. Município e UF entram no PDF e ajudam a equipe a considerar as regras locais depois.", { cor: CINZA });

await tela(
  "etapa-1-cliente",
  [
    { alvo: "cliente", texto: "Nome do cliente. Obrigatório, e é o que aparece no PDF. Use o nome que a cliente usa nas redes e na fachada." },
    { alvo: "municipio", texto: "Município do estabelecimento. A equipe técnica pesquisa a legislação local a partir dele." },
    { alvo: "uf", texto: "UF, só as duas letras. O campo já converte para maiúscula sozinho." },
    { alvo: "continuar", texto: "Continuar. Só habilita depois que o nome estiver preenchido." },
  ],
  { ate: 640 }
);

lista([
  { texto: "Nome do cliente. Obrigatório, e é o que aparece no PDF. Use o nome que a cliente usa nas redes e na fachada." },
  { texto: "Município do estabelecimento. A equipe técnica pesquisa a legislação local a partir dele." },
  { texto: "UF, só as duas letras. O campo já converte para maiúscula sozinho." },
  { texto: "Continuar. Só habilita depois que o nome estiver preenchido." },
]);

// ---------------------------------------------------------------- etapa 2

novaPagina();
cabecalho("Etapa 2 de 4");
faixaEtapa(2, "Operação declarada");
texto("Esta é a etapa que decide a pasta inteira. Escreva o que a cliente informou — só o que estiver aqui é considerado.", { cor: CINZA });

await tela(
  "etapa-2-operacao",
  [
    { alvo: "procedimentos", texto: "" },
    { alvo: "reutiliza", texto: "" },
    { alvo: "autoclave", texto: "" },
    { alvo: "equipamentos", texto: "" },
    { alvo: "analisar", texto: "" },
  ],
  { de: 296, ate: 1022 }
);

lista(
  [
    {
      texto: "Procedimentos realizados. Um por linha. Quanto mais exato o nome, mais certeiro o planejamento — a página seguinte mostra como escrever.",
    },
    {
      texto: "Reutiliza materiais? Responda pela rotina real da cliente. Junto com a autoclave, é o que decide se entram os documentos de esterilização.",
    },
    { texto: "Possui autoclave em funcionamento? Se ela reutiliza e não tem autoclave, o sistema avisa que isso precisa ser confirmado." },
    { texto: "Equipamentos declarados. Opcional, um por linha. É o que traz o POP de gestão e manutenção de equipamentos para a pasta." },
    { texto: "Analisar operação. A análise leva de quinze a quarenta segundos. Não clique duas vezes." },
  ],
  { tamanho: 9.8, gap: 6 }
);

// ---------------------------------------------------------------- como escrever

novaPagina();
cabecalho("Etapa 2 — como escrever");
titulo("Escreva o nome real, não o apelido");
texto(
  "O sistema entende apelido, sigla e marca — “botox”, “PEIM”, “skin”, “Ultraformer”. Mas quando o nome tem mais de um significado, ele pergunta em vez de adivinhar, e isso vira trabalho para você. Peça à cliente o nome exato de cada procedimento.",
  { cor: CINZA }
);

y -= 4;
duasColunas(
  {
    titulo: "Pode escrever assim",
    cor: VERDE,
    fundo: VERDE_PALE,
    marca: "✓",
    itens: [
      "botox, toxina, tox — vira Toxina Botulínica",
      "PEIM, secagem de vasinhos",
      "skin, skinbooster",
      "MMP, microagulhamento, drug delivery",
      "Ultraformer, CoolSculpting, HydraFacial",
      "Dysport, Sculptra, Juvederm — a marca conta como a técnica",
    ],
  },
  {
    titulo: "Aqui ele vai perguntar",
    cor: AMBAR,
    fundo: AMBAR_PALE,
    marca: "?",
    itens: [
      "“micro” — microagulhamento ou micropigmentação?",
      "“peeling” — químico, físico, de cristal?",
      "“laser” — depilação, pigmento, CO2?",
      "“Protocolo Detox” e outros nomes da casa — quais técnicas o compõem?",
      "“Heccus”, “Acrus”, “Ibramed” — aparelho multifunção e fabricante não dizem a técnica",
    ],
  }
);

aviso(
  "Se a cliente citar algo que a lei não permite, o sistema barra sozinho",
  "PMMA, silicone líquido industrial, câmara de bronzeamento artificial, formol como alisante e preenchedor manipulado em farmácia não geram documento nenhum. Aparece um aviso amarelo para você, e o assunto vai para a equipe técnica antes de qualquer proposta.",
  VERMELHO,
  rgb(253 / 255, 240 / 255, 240 / 255)
);

aviso(
  "Cirurgia, odontologia, exame de imagem e laboratório também ficam de fora",
  "São atividades com outro tipo de licenciamento. Se a cliente faz isso além da estética, o aviso explica que esse ponto é tratado separadamente — não entra nesta pasta nem neste preço.",
  ACAO,
  PALE
);

// ---------------------------------------------------------------- etapa 3

novaPagina();
cabecalho("Etapa 3 de 4");
faixaEtapa(3, "Revisão — o que entra na pasta");
texto("Aqui você confere com a cliente. Tudo o que mudar nesta tela recalcula documentos e preço na hora.", { cor: CINZA });

await tela("card-procedimentos", [
  { alvo: "contagem", texto: "" },
  { alvo: "caixa", texto: "" },
]);

lista(
  [
    { texto: "Quantos procedimentos estão valendo, de quantos foram identificados. É este número que define o preço." },
    { texto: "Desmarque para retirar um procedimento. Ele fica riscado, e os documentos que dependiam só dele saem da lista." },
  ],
  { tamanho: 9.8 }
);

y -= 4;
texto("Ao desmarcar, o procedimento fica riscado e as contas mudam na hora:", {
  fonte: fontes.corpoForte,
  tamanho: 10,
  gap: 2,
});
await tela("card-procedimentos-retirado", [{ alvo: "retirado", texto: "" }, { alvo: "contagem", texto: "" }]);

novaPagina();
cabecalho("Etapa 3 de 4");
faixaEtapa(3, "Revisão — os documentos previstos");
texto("A lista mostra tudo o que a equipe vai elaborar para essa operação. Vale passar os olhos com a cliente: é o tamanho do trabalho que ela está contratando.", { cor: CINZA });

await tela("card-documentos", [{ alvo: "contagem", texto: "" }, { alvo: "selo", texto: "" }], { ate: 388 });

lista(
  [
    { texto: "Total de documentos previstos. Além dos POPs de cada procedimento, entram os documentos que toda pasta tem: MBP, PGRSS, plano de segurança do paciente, fichas, termos e planilhas." },
    { texto: "A etiqueta mostra o tipo de cada documento. A lista continua abaixo — role a página para ver tudo com a cliente." },
  ],
  { tamanho: 9.8 }
);

// ---------------------------------------------------------------- avisos

novaPagina();
cabecalho("Etapa 3 — os avisos amarelos");
titulo("O quadro amarelo é a sua pauta com a cliente");
texto(
  "Cada linha ali é uma coisa que a equipe técnica precisa saber antes de produzir a pasta. Resolver isso na hora, com a cliente na linha, economiza dias depois.",
  { cor: CINZA }
);

await tela("card-alertas-legislacao", [{ alvo: "titulo", texto: "" }]);

y += 6;
titulo("O que fazer com cada tipo de aviso", { tamanho: 14 });
lista([
  {
    texto: "“Confirme se…” ou “o termo X é ambíguo” — pergunte à cliente e anote a resposta. Se o nome mudar, volte e refaça a análise com o nome certo.",
  },
  {
    texto: "“Informe quais técnicas compõem o protocolo” — nome comercial da casa. Peça a lista das técnicas que entram nele.",
  },
  {
    texto: "Aviso de legislação — algo que a cliente declarou não pode ser feito, ou não do jeito declarado. Trate com a equipe técnica antes de prometer qualquer coisa.",
    cor: AMBAR,
  },
]);

aviso(
  "A marca “não sai no PDF”",
  "O aviso de legislação aparece só para você, na tela. Ele não entra no PDF que a cliente recebe — essa conversa é sua, ao vivo, e não um papel que ela leva embora. Os outros avisos, esses sim, saem no documento.",
  AMBAR
);

// ---------------------------------------------------------------- etapa 4

novaPagina();
cabecalho("Etapa 4 de 4");
faixaEtapa(4, "Formato, preço e download");
texto("Os três formatos entregam o mesmo conteúdo. O que muda é a forma de entrega.", { cor: CINZA });

await tela(
  "etapa-4-formato",
  [
    { alvo: "cartoes", texto: "" },
    { alvo: "resumo", texto: "" },
    { alvo: "baixar", texto: "" },
  ],
  { de: 314, ate: 950 }
);

lista(
  [
    { texto: "Escolha o formato com a cliente. O valor de cada um aparece no próprio cartão, então dá para comparar na hora." },
    { texto: "Resumo do pedido: procedimentos, documentos, valor base, adicional por volume e total. O prazo padrão é de quinze dias úteis." },
    { texto: "Baixar PDF. O arquivo salva como pre-planejamento.pdf, na pasta de downloads do seu navegador." },
  ],
  { tamanho: 9.8 }
);

// ---------------------------------------------------------------- fechamento

novaPagina();
cabecalho("Depois do download");
titulo("O que fazer com o PDF");
lista([
  { texto: "Envie para a cliente pelo canal que vocês já usam. O documento tem marca d’água de provisório e diz, na própria capa, que passa por validação técnica." },
  { texto: "Passe para a equipe técnica os pontos do quadro amarelo, principalmente os que não saíram no PDF." },
  { texto: "Se a cliente mudar a lista de procedimentos depois, refaça a análise. O preço e a lista de documentos mudam junto." },
]);

y -= 6;
titulo("Se aparecer uma mensagem de erro", { tamanho: 15 });

const erros = [
  ["“O planejamento expirou ou foi alterado. Refaça a análise.”", "Passou de duas horas entre a análise e o download. Clique em “Refazer análise” e gere de novo."],
  ["“Não foi possível analisar agora. Verifique a conexão…”", "Queda de rede, ou análises demais em poucos minutos. Espere um pouco e tente de novo."],
  ["“O planejamento está temporariamente indisponível.”", "Instabilidade do serviço. Tente de novo em alguns minutos; o preenchimento continua guardado."],
  ["“Mantenha ao menos um procedimento para seguir.”", "Você desmarcou todos. Marque pelo menos um para continuar."],
];

for (const [mensagem, explicacao] of erros) {
  const linhasMensagem = quebrar(mensagem, fontes.corpoForte, 9.8, LARGURA_TEXTO - 24);
  const linhasExplicacao = quebrar(explicacao, fontes.corpo, 9.5, LARGURA_TEXTO - 24);
  const altura = 14 + linhasMensagem.length * 13 + linhasExplicacao.length * 12.5;
  y -= altura;
  pagina.drawRectangle({ x: MARGEM, y, width: LARGURA_TEXTO, height: altura, borderColor: BORDA, borderWidth: 0.8 });
  let linhaY = y + altura - 4;
  for (const linha of linhasMensagem) {
    linhaY -= 13;
    pagina.drawText(linha, { x: MARGEM + 12, y: linhaY, size: 9.8, font: fontes.corpoForte, color: NAVY });
  }
  for (const linha of linhasExplicacao) {
    linhaY -= 12.5;
    pagina.drawText(linha, { x: MARGEM + 12, y: linhaY, size: 9.5, font: fontes.corpo, color: CINZA });
  }
  y -= 8;
}

y -= 4;
aviso(
  "Na dúvida sobre um procedimento, pergunte antes de analisar",
  "O planejamento só considera o que está escrito. Um nome errado ou um apelido genérico custa uma análise a mais e, às vezes, uma proposta refeita.",
  ACAO,
  PALE
);

// ---------------------------------------------------------------- rodapé

const paginas = doc.getPages();
paginas.forEach((alvo, indice) => {
  if (indice === 0) return;
  const rotulo = `${indice + 1} de ${paginas.length}`;
  alvo.drawText(rotulo, {
    x: A4.largura - MARGEM - fontes.corpo.widthOfTextAtSize(rotulo, 8),
    y: 26,
    size: 8,
    font: fontes.corpo,
    color: CINZA,
  });
  alvo.drawText("Guia do time comercial — Pasta Sanitária", {
    x: MARGEM,
    y: 26,
    size: 8,
    font: fontes.corpo,
    color: CINZA,
  });
});

doc.setTitle("Como usar o pré-planejamento comercial — guia do time comercial");
doc.setAuthor("TreinaVISA");
doc.setSubject("Tutorial do link público de pré-planejamento da Pasta Sanitária");

writeFileSync(DESTINO, await doc.save());
console.log(`${paginas.length} páginas em ${DESTINO}`);
