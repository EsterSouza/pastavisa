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

  for (const dependency of ["@supabase/supabase-js", "@prisma/adapter-pg", "pg"]) {
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
    "DATABASE_URL",
    "FILE_STORAGE_DRIVER",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "APP_BASIC_AUTH_USER",
    "APP_BASIC_AUTH_PASSWORD",
  ]) {
    if (env.includes(key)) ok(`.env.example contem ${key}`);
    else fail(`.env.example nao contem ${key}`);
  }
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

if (process.exitCode) {
  console.error("Readiness check encontrou problemas.");
} else {
  console.log("Readiness check concluido sem falhas.");
}
