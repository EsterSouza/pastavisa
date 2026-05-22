const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const root = process.cwd();
const localDbPath = process.env.LOCAL_SQLITE_PATH
  ? path.resolve(process.env.LOCAL_SQLITE_PATH)
  : path.join(root, "prisma", "dev.db");
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pasta-visa";
const dryRun = process.env.DRY_RUN === "1";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Defina SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!fs.existsSync(localDbPath)) {
  console.error(`Banco local nao encontrado: ${localDbPath}`);
  process.exit(1);
}

function isCloudRef(value) {
  return /^supabase:\/\//i.test(String(value || "")) || /^https?:\/\/.+\.blob\.vercel-storage\.com\//i.test(String(value || ""));
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function safeStorageFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveLocalPath(value) {
  if (!value || isCloudRef(value)) return "";
  if (fs.existsSync(value)) return value;
  const normalized = String(value).replace(/\\/g, "/");
  const marker = "/pastavirus/";
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) {
    const relative = normalized.slice(markerIndex + marker.length);
    const candidate = path.join(root, relative);
    if (fs.existsSync(candidate)) return candidate;
  }
  if (normalized.startsWith("storage/")) {
    const candidate = path.join(root, normalized);
    if (fs.existsSync(candidate)) return candidate;
  }
  return "";
}

function storageKeyFor(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const marker = "/storage/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return `storage/${normalized.slice(markerIndex + marker.length)}`
      .split("/")
      .map(safeStorageFileName)
      .join("/");
  }
  return `storage/migrated/${safeStorageFileName(path.basename(filePath))}`;
}

function supabaseRef(filePath) {
  return `supabase://${bucket}/${filePath}`;
}

async function createBucketIfNeeded(supabase) {
  const { data } = await supabase.storage.getBucket(bucket);
  if (data || dryRun) return;

  const { error } = await supabase.storage.createBucket(bucket, {
    public: false,
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Falha ao criar bucket ${bucket}: ${error.message}`);
  }
}

async function updateTargetPg(pool, table, id, field, value) {
  if (!pool || dryRun) return;
  await pool.query(`update "${table}" set "${field}" = $1 where "id" = $2`, [value, id]);
}

async function migrateRef({ supabase, pool, table, id, field, value }) {
  const localPath = resolveLocalPath(value);
  if (!localPath) return null;

  const key = storageKeyFor(localPath);
  const ref = supabaseRef(key);
  if (!dryRun) {
    const { error } = await supabase.storage.from(bucket).upload(key, fs.readFileSync(localPath), {
      contentType: contentTypeFor(localPath),
      upsert: true,
    });
    if (error) throw new Error(`Falha ao enviar ${localPath}: ${error.message}`);
    await updateTargetPg(pool, table, id, field, ref);
  }

  return { table, id, field, from: localPath, to: ref };
}

async function main() {
  const localDb = new Database(localDbPath, { readonly: true });
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const pool = databaseUrl?.startsWith("postgres")
    ? new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
      })
    : null;

  await createBucketIfNeeded(supabase);

  const refs = [];
  for (const row of localDb.prepare('select id, clienteLogoPath, formsPdfPath, documentosElaboracaoPath from "Pasta"').all()) {
    refs.push({ table: "Pasta", id: row.id, field: "clienteLogoPath", value: row.clienteLogoPath });
    refs.push({ table: "Pasta", id: row.id, field: "formsPdfPath", value: row.formsPdfPath });
    refs.push({ table: "Pasta", id: row.id, field: "documentosElaboracaoPath", value: row.documentosElaboracaoPath });
  }
  for (const row of localDb.prepare('select id, arquivoPath from "Template"').all()) {
    refs.push({ table: "Template", id: row.id, field: "arquivoPath", value: row.arquivoPath });
  }
  for (const row of localDb.prepare('select id, outputPath from "DocumentoGerado"').all()) {
    refs.push({ table: "DocumentoGerado", id: row.id, field: "outputPath", value: row.outputPath });
  }

  const migrated = [];
  for (const ref of refs) {
    const result = await migrateRef({ supabase, pool, ...ref });
    if (result) {
      migrated.push(result);
      console.log(`${result.table}.${result.field}: ${result.from} -> ${result.to}`);
    }
  }

  localDb.close();
  if (pool) await pool.end();

  const reportPath = path.join(root, "backups", `supabase-storage-migration-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ dryRun, bucket, migrated }, null, 2), "utf8");
  console.log(`Relatorio salvo em: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
