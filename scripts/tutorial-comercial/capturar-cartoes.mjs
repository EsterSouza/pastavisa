// Segunda leva de telas: cartões da revisão em recorte fechado, o efeito de
// desmarcar um procedimento e o aviso de legislação com a marca "não sai no PDF".

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "https://pastavisa.vercel.app";
const SAIDA = process.argv[3];
mkdirSync(SAIDA, { recursive: true });

const PROCEDIMENTOS = [
  "Limpeza de pele",
  "Toxina botulínica",
  "Preenchimento labial com ácido hialurônico",
  "Microagulhamento",
  "Drenagem linfática",
  "PMMA",
].join("\n");

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 900, height: 1200 },
  deviceScaleFactor: 2,
  colorScheme: "light",
  locale: "pt-BR",
});
const pagina = await contexto.newPage();
const capturas = [];

async function capturar(id, seletor, alvos = {}, opcoes = {}) {
  const container = pagina.locator(seletor).first();
  const caixa = await container.boundingBox();
  const resolvidos = {};

  for (const [chave, alvoSeletor] of Object.entries(alvos)) {
    const alvo = pagina.locator(alvoSeletor).first();
    if ((await alvo.count()) === 0) continue;
    const b = await alvo.boundingBox();
    if (!b) continue;
    resolvidos[chave] = {
      x: +(b.x - caixa.x).toFixed(1),
      y: +(b.y - caixa.y).toFixed(1),
      w: +b.width.toFixed(1),
      h: +b.height.toFixed(1),
    };
  }

  const arquivo = `${id}.png`;
  const altura = opcoes.alturaMaxima ? Math.min(caixa.height, opcoes.alturaMaxima) : caixa.height;
  await container.screenshot({
    path: join(SAIDA, arquivo),
    clip: opcoes.alturaMaxima
      ? { x: caixa.x, y: caixa.y, width: caixa.width, height: altura }
      : undefined,
  });
  capturas.push({ id, arquivo, largura: +caixa.width.toFixed(1), altura: +altura.toFixed(1), alvos: resolvidos });
  console.log(`ok ${id} — ${caixa.width.toFixed(0)}x${altura.toFixed(0)}`);
}

await pagina.goto(`${BASE}/planner`, { waitUntil: "networkidle" });
await pagina.fill("#cliente", "Clínica Exemplo Estética");
await pagina.fill("#municipio", "Curitiba");
await pagina.fill("#uf", "PR");
await pagina.click('button:has-text("Continuar")');
await pagina.waitForSelector("#procedimentos");
await pagina.fill("#procedimentos", PROCEDIMENTOS);
await pagina.check('input[name="reutiliza-materiais"][value="true"]');
await pagina.check('input[name="possui-autoclave"][value="true"]');
await pagina.click('button:has-text("Analisar operação")');
await pagina.waitForSelector('h2:has-text("Revise o que entra na pasta")', { timeout: 120_000 });
await pagina.waitForTimeout(500);

const PROCEDIMENTOS_CARD = 'section[aria-labelledby="revisao-procedimentos"]';
const DOCUMENTOS_CARD = 'section[aria-labelledby="revisao-documentos"]';
const ALERTAS_CARD = 'section[aria-labelledby="revisao-alertas"]';

await capturar("card-procedimentos", PROCEDIMENTOS_CARD, {
  contagem: `${PROCEDIMENTOS_CARD} p[aria-live="polite"]`,
  item: `${PROCEDIMENTOS_CARD} li:first-child label`,
  caixa: `${PROCEDIMENTOS_CARD} li:first-child input`,
});

await capturar("card-documentos", DOCUMENTOS_CARD, {
  contagem: `${DOCUMENTOS_CARD} p[aria-live="polite"]`,
  selo: `${DOCUMENTOS_CARD} li:first-child span:first-child`,
}, { alturaMaxima: 560 });

// Desmarcar um procedimento: contagem e lista de documentos mudam na hora.
const itens = pagina.locator(`${PROCEDIMENTOS_CARD} li input[type="checkbox"]`);
const total = await itens.count();
if (total > 1) {
  await itens.nth(total - 1).uncheck();
  await pagina.waitForTimeout(300);
  await capturar("card-procedimentos-retirado", PROCEDIMENTOS_CARD, {
    contagem: `${PROCEDIMENTOS_CARD} p[aria-live="polite"]`,
    retirado: `${PROCEDIMENTOS_CARD} li:last-child label`,
  });
  await itens.nth(total - 1).check();
}

if ((await pagina.locator(ALERTAS_CARD).count()) > 0) {
  const marcas = pagina.locator(`${ALERTAS_CARD} li span`);
  console.log(`marcas "não sai no PDF": ${await marcas.count()}`);
  await capturar("card-alertas-legislacao", ALERTAS_CARD, {
    titulo: `${ALERTAS_CARD} h3`,
    marca: `${ALERTAS_CARD} li span`,
  });
  const textos = await pagina.locator(`${ALERTAS_CARD} li`).allInnerTexts();
  writeFileSync(join(SAIDA, "alertas.json"), JSON.stringify(textos, null, 2));
  for (const t of textos) console.log(`  ! ${t}`);
} else {
  console.log("! sem alertas");
}

const procedimentos = await pagina.locator(`${PROCEDIMENTOS_CARD} li label span:first-of-type`).allInnerTexts();
console.log(`procedimentos no plano: ${procedimentos.join(" | ")}`);

writeFileSync(join(SAIDA, "capturas-2.json"), JSON.stringify(capturas, null, 2));
await navegador.close();
