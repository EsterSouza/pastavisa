const fs = require("fs");
const path = require("path");

const root = process.cwd();

function ok(message) {
  console.log(`OK  ${message}`);
}

function warn(message) {
  console.warn(`WARN ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function checkPackage() {
  const pkg = JSON.parse(read("package.json"));
  if (pkg.scripts?.postinstall?.includes("prisma")) ok("postinstall gera o Prisma Client");
  else fail("adicione postinstall com prisma generate");

  for (const script of ["backup:local", "migrate:local-to-supabase", "migrate:storage-to-supabase"]) {
    if (pkg.scripts?.[script]) ok(`script ${script} existe`);
    else fail(`script ${script} ausente`);
  }

  for (const dependency of ["@supabase/ssr", "@supabase/supabase-js", "@prisma/adapter-pg", "pg"]) {
    if (pkg.dependencies?.[dependency]) ok(`dependencia ${dependency} existe`);
    else fail(`dependencia ${dependency} ausente`);
  }
}

function checkGitignore() {
  const gitignore = read(".gitignore");
  for (const pattern of ["/backups/", ".env", "/prisma/dev.db", "/storage/output/", "/storage/uploads/", "/storage/logos/"]) {
    if (gitignore.includes(pattern)) ok(`.gitignore protege ${pattern}`);
    else fail(`.gitignore nao protege ${pattern}`);
  }
}

function routeFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(full));
    if (entry.isFile() && entry.name === "route.ts") files.push(full);
  }
  return files;
}

function checkRoutes() {
  const files = routeFiles(path.join(root, "app", "api"));
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    if (content.includes('runtime = "nodejs"')) ok(`${rel} usa runtime nodejs`);
    else warn(`${rel} sem runtime nodejs explicito`);

    if (content.includes('dynamic = "force-dynamic"')) ok(`${rel} e dinamica`);
    else warn(`${rel} sem dynamic force-dynamic`);
  }
}

function checkEnvExample() {
  const env = read(".env.example");
  for (const key of [
    "ANTHROPIC_API_KEY",
    "PLANNER_SIGNING_SECRET",
    "DATABASE_URL",
    "FILE_STORAGE_DRIVER",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
  ]) {
    if (env.includes(key)) ok(`.env.example contem ${key}`);
    else fail(`.env.example nao contem ${key}`);
  }
}

function checkPublicPlanner() {
  for (const file of [
    "app/api/planejamento-comercial/analisar/route.ts",
    "lib/commercial-planner/pricing.ts",
    "lib/commercial-planner/signed-plan.ts",
    "lib/commercial-planner/safe-logging.ts",
    "scripts/planner-firewall-rules.json",
  ]) {
    if (fs.existsSync(path.join(root, file))) ok(`${file} existe`);
    else fail(`${file} ausente`);
  }

  const route = read("app/api/planejamento-comercial/analisar/route.ts");
  const validation = read("lib/commercial-planner/validation.ts");
  if (
    validation.includes("12 * 1024") &&
    validation.includes("8 * 1024") &&
    route.includes('"Cache-Control": "no-store"') &&
    route.includes("export async function POST") &&
    !/export async function (GET|PUT|PATCH|DELETE)/.test(route)
  ) {
    ok("rota publica limita payload, desabilita cache e aceita somente POST");
  } else {
    fail("rota publica deve limitar payload, usar no-store e aceitar somente POST");
  }

  if (!/@\/lib\/(prisma|file-storage|supabase)/.test(route) && !/service.?role/i.test(route)) {
    ok("fronteira publica nao importa persistencia nem service role");
  } else {
    fail("fronteira publica nao pode importar Prisma, Storage, Supabase ou service role");
  }

  const authorization = read("lib/auth/authorization.ts");
  if (
    authorization.includes('pathname === "/api/planejamento-comercial/analisar"') &&
    authorization.includes('pathname === "/api/planejamento-comercial/pdf"') &&
    !authorization.includes('matchesPrefix(pathname, "/api/planejamento-comercial")') &&
    !authorization.includes('matchesPrefix(pathname, "/api/planner")')
  ) {
    ok("middleware libera somente as APIs publicas previstas do planner");
  } else {
    fail("middleware deve liberar somente analisar e PDF, sem prefixo amplo de API");
  }

  const firewall = JSON.parse(read("scripts/planner-firewall-rules.json"));
  const expectedPaths = [
    "/api/planejamento-comercial/analisar",
    "/api/planejamento-comercial/pdf",
  ];
  const validFirewall =
    Array.isArray(firewall.rules) &&
    firewall.rules.length === 1 &&
    JSON.stringify(firewall.rules[0].paths) === JSON.stringify(expectedPaths) &&
    firewall.rules[0].requests === 10 &&
    firewall.rules[0].method === "POST" &&
    firewall.rules[0].windowSeconds === 300 &&
    firewall.rules[0].key === "ip" &&
    firewall.rules[0].action === "rate_limit" &&
    firewall.rules[0].status === 429;
  if (validFirewall) ok("especificacao WAF Hobby limita analise e PDF por IP em uma regra");
  else fail("especificacao WAF do planner esta incompleta");

  const readiness = read("lib/env-readiness.ts");
  if (readiness.includes('name: "planner-signing"') && readiness.includes('hasEnv("PLANNER_SIGNING_SECRET")')) {
    ok("readiness exige assinatura HMAC do planner");
  } else {
    fail("readiness deve exigir PLANNER_SIGNING_SECRET");
  }
}

function checkAuthentication() {
  for (const file of [
    "lib/supabase/browser.ts",
    "lib/supabase/server.ts",
    "lib/supabase/middleware.ts",
    "lib/auth/authorization.ts",
  ]) {
    if (fs.existsSync(path.join(root, file))) ok(`${file} existe`);
    else fail(`${file} ausente`);
  }

  if (!fs.existsSync(path.join(root, "lib/session-auth.ts"))) ok("sessao temporaria removida");
  else fail("remova lib/session-auth.ts");

  const middleware = read("middleware.ts");
  if (middleware.includes("updateSession") && middleware.includes("isAdminOnlyPath")) {
    ok("middleware usa Supabase Auth e RBAC");
  } else {
    fail("middleware deve validar Supabase Auth e RBAC");
  }

  for (const file of routeFiles(path.join(root, "app", "api"))) {
    const content = fs.readFileSync(file, "utf8");
    if (!content.includes("export async function DELETE")) continue;
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (content.includes("requireAdmin")) ok(`${rel} protege DELETE no handler`);
    else fail(`${rel} deve proteger DELETE no handler`);
  }

  const loginSources = [read("app/(public)/login/page.tsx"), read("app/api/auth/login/route.ts")].join("\n");
  if (!/sign\s?up/i.test(loginSources)) ok("cadastro publico ausente");
  else fail("login interno nao pode oferecer cadastro");
}

function checkSupabaseStorageDriver() {
  const storage = read("lib/file-storage.ts");
  const uploadSignRoute = read("app/api/uploads/sign/route.ts");
  const envReadiness = read("lib/env-readiness.ts");
  const supportsSupabase =
    storage.includes('configured === "supabase"') &&
    storage.includes('storageDriver() === "supabase"') &&
    storage.includes("createSignedStorageUpload") &&
    storage.includes("supabase.storage.from");
  if (supportsSupabase) ok("storage suporta Supabase");
  else fail("storage nao suporta Supabase");

  if (storage.includes("SUPABASE_SERVICE_ROLE_KEY") && !storage.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) {
    ok("service role nao usa prefixo publico");
  } else {
    fail("service role deve ficar apenas no servidor");
  }

  if (
    uploadSignRoute.includes("Uploads grandes exigem Supabase Storage em producao") &&
    uploadSignRoute.includes("process.env.VERCEL")
  ) {
    ok("upload grande nao cai em multipart na Vercel");
  } else {
    fail("upload grande em producao deve exigir Supabase Storage antes de chamar /api/extrair");
  }

  if (envReadiness.includes("Storage local nao atende uploads grandes em producao")) {
    ok("health/readiness acusa storage local em producao");
  } else {
    fail("readiness deve reprovar storage local em producao");
  }
}

checkPackage();
checkGitignore();
checkRoutes();
checkEnvExample();
checkSupabaseStorageDriver();
checkAuthentication();
checkPublicPlanner();

if (process.exitCode) {
  console.error("Readiness check encontrou problemas.");
} else {
  console.log("Readiness check concluido sem falhas.");
}
