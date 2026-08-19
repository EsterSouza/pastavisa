#!/usr/bin/env node
/**
 * Auditoria da fronteira pública do PastaVISA (PV-012).
 *
 * O planner é a única parte do produto que responde sem login, e as regras que o
 * mantêm seguro são invisíveis no diff: quem acrescenta uma rota ao `isPublicPath`
 * abre a aplicação para a internet sem que nenhum teste de unidade reclame. Este
 * script existe para que essa abertura seja sempre um ato deliberado — a lista
 * abaixo tem de ser editada junto, e o commit passa a mostrar a decisão.
 *
 * Roda sem servidor e sem segredo. Uso: `npm run check:public-boundary`.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
let failures = 0;

function ok(message) {
  console.log(`OK   ${message}`);
}

function fail(message, detail) {
  console.error(`FAIL ${message}`);
  if (detail) console.error(`     ${detail}`);
  failures += 1;
}

function note(message) {
  console.log(`--   ${message}`);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function walk(dir, filter) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel, filter);
    return entry.isFile() && filter(entry.name) ? [rel] : [];
  });
}

const isSource = (name) => /\.(ts|tsx|mjs|js|jsx)$/.test(name);

/* ------------------------------------------------------------------ *
 * 1. Superfície pública declarada
 * ------------------------------------------------------------------ */

// Toda entrada aqui responde sem sessão. Acrescentar uma linha é decidir expor
// aquele caminho à internet; o script falha até que a decisão esteja escrita.
const PUBLIC_SURFACE = [
  "/login",
  "/api/auth",
  "/api/health",
  "/planner",
  "/api/planejamento-comercial/analisar",
  "/api/planejamento-comercial/pdf",
];

// Caminhos que exigem papel `admin`. Tirar um daqui rebaixa a proteção para
// "qualquer pessoa logada", que inclui o operador.
const ADMIN_SURFACE = ["/templates", "/legislacoes", "/api/templates", "/api/legislacoes"];

function checkPublicSurface() {
  const source = read("lib/auth/authorization.ts");
  const start = source.indexOf("export function isPublicPath");
  const body = source.slice(start, source.indexOf("\n}", start));
  const declared = [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

  const extra = declared.filter((entry) => !PUBLIC_SURFACE.includes(entry));
  const missing = PUBLIC_SURFACE.filter((entry) => !declared.includes(entry));

  if (extra.length) {
    fail(
      "isPublicPath expõe caminho que a fronteira não declara",
      `${extra.join(", ")} — se a exposição é intencional, acrescente em PUBLIC_SURFACE neste script.`
    );
  }
  if (missing.length) {
    fail(
      "a fronteira declara caminho público que isPublicPath não tem mais",
      `${missing.join(", ")} — remova de PUBLIC_SURFACE se a rota deixou de existir.`
    );
  }
  if (!extra.length && !missing.length) {
    ok(`superfície pública inalterada (${PUBLIC_SURFACE.length} caminhos)`);
  }

  const adminMatch = source.match(/const ADMIN_PREFIXES = \[([^\]]*)\]/);
  const admin = adminMatch ? [...adminMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  if (admin.join("|") === ADMIN_SURFACE.join("|")) ok("prefixos de admin inalterados");
  else
    fail(
      "ADMIN_PREFIXES mudou",
      `esperado ${ADMIN_SURFACE.join(", ")}; encontrado ${admin.join(", ") || "(nada)"}`
    );
}

/* ------------------------------------------------------------------ *
 * 2. O planner público não persiste nada
 * ------------------------------------------------------------------ */

function checkNoPersistence() {
  const files = [
    ...walk("app/api/planejamento-comercial", isSource),
    ...walk("lib/commercial-planner", isSource),
  ];
  const writes = [];
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/prisma\.(\w+)\.(\w+)/g)) {
      // Regra 9 do handoff: o planner não persiste texto, planejamento, PDF,
      // lead ou dado pessoal. Leitura do catálogo é o único acesso permitido.
      if (!["findMany", "findUnique", "findFirst", "count"].includes(match[2])) {
        writes.push(`${file}: ${match[0]}`);
      }
    }
  }
  if (writes.length) fail("o planner público escreve no banco", writes.join("; "));
  else ok(`nenhuma escrita no banco em ${files.length} arquivos do planner`);
}

/* ------------------------------------------------------------------ *
 * 3. As rotas públicas só registram log pela via segura
 * ------------------------------------------------------------------ */

function checkSafeLogging() {
  const offenders = [];
  for (const file of walk("app/api/planejamento-comercial", isSource)) {
    // `logPlannerRequest` publica identificador, duração, status e quantidades.
    // Um `console.*` solto ao lado dele é o caminho por onde o texto do cliente
    // vazaria para o log da Vercel.
    if (/\bconsole\.\w+\(/.test(read(file))) offenders.push(file);
  }
  if (offenders.length) fail("rota pública com console.* fora do log seguro", offenders.join(", "));
  else ok("rotas públicas registram log somente por logPlannerRequest");
}

/* ------------------------------------------------------------------ *
 * 4. Vocabulário da interface pública (regra 8 do handoff)
 * ------------------------------------------------------------------ */

const FORBIDDEN_UI = [
  [/\bintelig[eê]ncia artificial\b/i, "inteligência artificial"],
  [/\bmodelo de linguagem\b/i, "modelo de linguagem"],
  [/\btemplates?\b/i, "template"],
  [/\bprompts?\b/i, "prompt"],
  [/(^|[^A-Za-z])IA([^A-Za-z]|$)/, "IA"],
];

function checkPublicVocabulary() {
  const files = [
    ...walk("app/(public)", isSource),
    ...walk("components/commercial-planner", isSource),
  ];
  const offenders = [];
  for (const file of files) {
    const source = read(file);
    for (const [pattern, label] of FORBIDDEN_UI) {
      if (pattern.test(source)) offenders.push(`${file}: ${label}`);
    }
  }
  if (offenders.length) fail("vocabulário proibido na interface pública", offenders.join("; "));
  else ok(`vocabulário da interface pública limpo em ${files.length} arquivos`);
}

/* ------------------------------------------------------------------ *
 * 5. Nome de variável pública que carrega cara de segredo
 * ------------------------------------------------------------------ */

const SECRET_SHAPED = /NEXT_PUBLIC_\w*(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE|ANTHROPIC|DATABASE)\w*/;

// Os próprios auditores citam o nome proibido para poder recusá-lo. São a única
// exceção legítima, e ficam nomeados um a um para que a lista não vire escape.
const AUDIT_SCRIPTS = ["check-deploy-readiness.js", "check-public-boundary.mjs"];

function checkPublicEnvNames() {
  const files = [
    ...walk("app", isSource),
    ...walk("components", isSource),
    ...walk("lib", isSource),
    ...walk("scripts", isSource),
    ...walk("tests", isSource),
    ".env.example",
  ];
  const offenders = [];
  for (const file of files) {
    if (AUDIT_SCRIPTS.includes(path.basename(file))) continue;
    const match = read(file).match(SECRET_SHAPED);
    if (match) offenders.push(`${file}: ${match[0]}`);
  }
  if (offenders.length) fail("variável NEXT_PUBLIC_ com nome de segredo", offenders.join("; "));
  else ok("nenhuma variável NEXT_PUBLIC_ com nome de segredo");
}

/* ------------------------------------------------------------------ *
 * 6. Bundle entregue ao navegador
 * ------------------------------------------------------------------ */

// Marcadores do que nunca pode ser servido ao navegador. Cada um é o formato
// literal do segredo, não o nome da variável: é assim que ele apareceria se
// tivesse sido embutido por engano.
const BUNDLE_MARKERS = [
  [/sk-ant-[A-Za-z0-9-]{8}/, "chave da Anthropic"],
  [/postgres(?:ql)?:\/\/[^\s"']+/, "connection string do Postgres"],
  [/sb_secret_[A-Za-z0-9_-]{8}/, "chave secreta do Supabase"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada"],
];

// JWT literal dentro do bundle. A chave service role do Supabase é um JWT cujo
// payload diz `"role":"service_role"` — procurar a palavra solta não serve, ela
// aparece em comentário de documentação do próprio SDK.
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.([A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;

function jwtDeServiceRole(conteudo) {
  for (const match of conteudo.matchAll(JWT)) {
    let payload;
    try {
      payload = Buffer.from(match[1], "base64url").toString("utf8");
    } catch {
      continue;
    }
    if (/"role"\s*:\s*"service_role"/.test(payload)) return true;
  }
  return false;
}

function checkClientBundle() {
  const chunks = walk(path.join(".next", "static"), (name) => name.endsWith(".js"));
  if (!chunks.length) {
    note("bundle do cliente não auditado: rode `npm run build` antes para conferir .next/static");
    return;
  }
  // `next dev` sobrescreve `.next` com bundles de desenvolvimento — não
  // minificados e cheios de comentário do SDK. Auditar isso não diz nada sobre o
  // que produção serve, e dá alarme falso.
  if (fs.existsSync(path.join(root, ".next", "static", "development"))) {
    note("bundle em .next é de desenvolvimento; rode `npm run build` para auditar o que produção serve");
    return;
  }

  const offenders = [];
  for (const chunk of chunks) {
    const source = read(chunk);
    for (const [pattern, label] of BUNDLE_MARKERS) {
      if (pattern.test(source)) offenders.push(`${chunk}: ${label}`);
    }
    if (jwtDeServiceRole(source)) offenders.push(`${chunk}: chave service role do Supabase`);
  }
  if (offenders.length) fail("segredo embutido no bundle do cliente", offenders.join("; "));
  else ok(`bundle do cliente limpo em ${chunks.length} arquivos`);
}

checkPublicSurface();
checkNoPersistence();
checkSafeLogging();
checkPublicVocabulary();
checkPublicEnvNames();
checkClientBundle();

if (failures) {
  console.error(`\n${failures} verificacao(oes) de fronteira falharam.`);
  process.exit(1);
}
console.log("\nFronteira publica integra.");
