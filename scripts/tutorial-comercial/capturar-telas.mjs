// Captura as telas reais do planner em produção e as coordenadas dos campos, para o
// PDF do tutorial desenhar as marcações exatamente em cima do elemento certo.

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
  "Peeling",
  "Drenagem linfática",
].join("\n");

const EQUIPAMENTOS = ["Autoclave 21 litros", "Alta frequência", "Laser de diodo"].join("\n");

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 900, height: 1200 },
  deviceScaleFactor: 2,
  colorScheme: "light",
  locale: "pt-BR",
});
const pagina = await contexto.newPage();
const capturas = [];

async function capturar(id, seletorContainer, alvos) {
  const container = pagina.locator(seletorContainer).first();
  const caixa = await container.boundingBox();
  const resolvidos = {};

  for (const [chave, seletor] of Object.entries(alvos)) {
    const alvo = pagina.locator(seletor).first();
    if ((await alvo.count()) === 0) {
      console.log(`  ! alvo ausente: ${chave} (${seletor})`);
      continue;
    }
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
  await container.screenshot({ path: join(SAIDA, arquivo) });
  capturas.push({
    id,
    arquivo,
    largura: +caixa.width.toFixed(1),
    altura: +caixa.height.toFixed(1),
    alvos: resolvidos,
  });
  console.log(`ok ${id} — ${caixa.width.toFixed(0)}x${caixa.height.toFixed(0)} — ${Object.keys(resolvidos).length} alvos`);
}

await pagina.goto(`${BASE}/planner`, { waitUntil: "networkidle" });

// ETAPA 1 — cliente e local, já preenchida.
await pagina.fill("#cliente", "Clínica Exemplo Estética");
await pagina.fill("#municipio", "Curitiba");
await pagina.fill("#uf", "PR");
await capturar("etapa-1-cliente", "main > div", {
  etapas: 'nav[aria-label="Etapas do planejamento"]',
  cliente: "#cliente",
  municipio: "#municipio",
  uf: "#uf",
  continuar: 'button:has-text("Continuar")',
});

// ETAPA 2 — operação declarada.
await pagina.click('button:has-text("Continuar")');
await pagina.waitForSelector("#procedimentos");
await pagina.fill("#procedimentos", PROCEDIMENTOS);
await pagina.fill("#equipamentos", EQUIPAMENTOS);
await pagina.check('input[name="reutiliza-materiais"][value="true"]');
await pagina.check('input[name="possui-autoclave"][value="true"]');
await capturar("etapa-2-operacao", "main > div", {
  procedimentos: "#procedimentos",
  dica: "#procedimentos-hint",
  reutiliza: 'fieldset:has(input[name="reutiliza-materiais"])',
  autoclave: 'fieldset:has(input[name="possui-autoclave"])',
  equipamentos: "#equipamentos",
  analisar: 'button:has-text("Analisar operação")',
});

// ETAPA 3 — revisão. A análise real leva algumas dezenas de segundos.
await pagina.click('button:has-text("Analisar operação")');
await pagina.waitForSelector('h2:has-text("Revise o que entra na pasta")', { timeout: 120_000 });
await pagina.waitForTimeout(500);
await capturar("etapa-3-revisao", "main > div", {
  procedimentos: 'section[aria-labelledby="revisao-procedimentos"]',
  contagem: 'section[aria-labelledby="revisao-procedimentos"] p[aria-live="polite"]',
  primeiroItem: 'section[aria-labelledby="revisao-procedimentos"] li:first-child label',
  documentos: 'section[aria-labelledby="revisao-documentos"]',
  continuar: 'button:has-text("Continuar")',
  refazer: 'button:has-text("Refazer análise")',
});

const alertas = pagina.locator('section[aria-labelledby="revisao-alertas"]');
if ((await alertas.count()) > 0) {
  await capturar("etapa-3-alertas", 'section[aria-labelledby="revisao-alertas"]', {
    titulo: 'section[aria-labelledby="revisao-alertas"] h3',
    primeiro: 'section[aria-labelledby="revisao-alertas"] li:first-child',
  });
  const marca = pagina.locator('section[aria-labelledby="revisao-alertas"] li span');
  console.log(`marcas "não sai no PDF": ${await marca.count()}`);
} else {
  console.log("! sem seção de alertas nesta análise");
}

// ETAPA 4 — formato e preço.
await pagina.click('button:has-text("Continuar")');
await pagina.waitForSelector('h2:has-text("Escolha o formato de entrega")');
await pagina.waitForTimeout(300);
await capturar("etapa-4-formato", "main > div", {
  cartoes: "fieldset:has(input[name='formato'])",
  digital: "label:has(input[value='digital'])",
  colorida: "label:has(input[value='colorida'])",
  resumo: 'section[aria-labelledby="resumo-valor"]',
  baixar: 'button:has-text("Baixar PDF")',
});

writeFileSync(join(SAIDA, "capturas.json"), JSON.stringify(capturas, null, 2));
console.log(`\n${capturas.length} capturas em ${SAIDA}`);

await navegador.close();
