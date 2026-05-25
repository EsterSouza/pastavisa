const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env" });
// Keep the pooler DATABASE_URL from .env when present; direct database hosts may be IPv6-only.
require("dotenv").config({ path: ".env.local" });

const root = process.cwd();
const sourceDir = path.join(root, "TODOS_OS_TEMPLATES_PastaVISA");
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pasta-visa";
const templatePrefix = "storage/templates";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel ausente: ${name}`);
  return value;
}

function normalizeName(value) {
  return value
    .replace(/^bulk_\d+_/i, "")
    .replace(/^TEMPLATE_/i, "")
    .replace(/_/g, " ")
    .replace(/\.docx$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function displayName(file) {
  return file
    .replace(/^TEMPLATE_/i, "")
    .replace(/_/g, " ")
    .replace(/\.docx$/i, "");
}

function safeStorageFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function storageBaseName(ref) {
  if (!ref) return "";
  return String(ref).split("/").pop() || "";
}

function storagePathFromRef(ref) {
  if (!ref || !String(ref).startsWith("supabase://")) return "";
  const withoutProtocol = String(ref).replace(/^supabase:\/\//, "");
  const slash = withoutProtocol.indexOf("/");
  return slash === -1 ? "" : withoutProtocol.slice(slash + 1);
}

function inferMeta(filename) {
  const n = filename.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\-]/g, " ");
  let tipo = "OUTROS";
  if (n.includes("MBP") || n.includes("MANUAL DE BOAS PRATICAS")) tipo = "MBP";
  else if (n.includes("POP") || n.includes("PROCEDIMENTO OPERACIONAL")) tipo = "POP";
  else if (n.includes("TCLE")) tipo = "TCLE";
  else if (n.includes("PGRSS")) tipo = "PGRSS";
  else if (n.includes("FICHA")) tipo = "FICHA";
  else if (n.includes("PLANILHA") || n.includes("CONTROLE")) tipo = "PLANILHA";
  else if (n.includes("GUIA")) tipo = "GUIA";
  else if (n.includes("TERMO") || n.includes("RENUNCIA") || n.includes("RECUSA")) tipo = "TERMO";
  else if (n.includes("RECEITUARIO") || n.includes("ORIENTACOES")) tipo = "RECEITUARIO";

  let padraoHeader = "A";
  if (tipo === "POP") padraoHeader = "B";
  else if (["TCLE", "FICHA", "TERMO", "RECEITUARIO", "PLANILHA"].includes(tipo)) padraoHeader = "C";
  return { tipo, padraoHeader };
}

function detectProcessingType(filename) {
  const n = filename.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\-.]/g, " ");
  const headerOnly = ["PLANILHA", "CONTROLE DE ENTREGA", "CONTROLE DE TEMPERATURA", "CONTROLE DE LIMPEZA", "REGISTRO DE ESTERILIZACAO", "RASTREABILIDADE", "FICHA DE ANAMNESE", "FICHA ANAMNESE", "TERMO DE AUTORIZACAO", "TERMO DE RENUNCIA", "TERMO DE RECUSA", "ENCAMINHAMENTO", "FORMULARIO DE NOTIFICACAO"];
  if (headerOnly.some((k) => n.includes(k))) return "HEADER_ONLY";
  const sonnet = ["IMPLEMENTACAO DO PROCESSO DE ENFERMAGEM", "SAE", "INTERCORRENCIAS EMERGENCIAS", "INTERCORRENCIAS E EMERGENCIAS", "PGRSS", "PLANO DE GERENCIAMENTO", "PLANO DE SEGURANCA DO PACIENTE", "PSP", "MANUAL DE BOAS PRATICAS", "MBP", "RELACAO DE SERVICOS"];
  if (sonnet.some((k) => n.includes(k))) return "SONNET_REQUIRED";
  const heavy = ["RELACAO DE EQUIPAMENTOS E SERVICOS", "GUIA DE UTILIZACAO", "GUIA UTILIZACAO", "ORIENTACOES POS", "ORIENTACOES DE USO"];
  if (heavy.some((k) => n.includes(k))) return "HEAVY_HAIKU";
  return "LIGHT_HAIKU";
}

async function main() {
  if (!fs.existsSync(sourceDir)) throw new Error(`Pasta local nao encontrada: ${sourceDir}`);

  const databaseUrl = required("DATABASE_URL");
  const supabaseUrl = process.env.SUPABASE_URL || required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const pool = new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false } });

  const files = fs.readdirSync(sourceDir).filter((file) => file.toLowerCase().endsWith(".docx")).sort();
  const existingRows = await pool.query('select "id", "nome", "arquivoPath" from "Template"');
  const existingRowsList = existingRows.rows;
  const existing = new Set(existingRowsList.map((row) => normalizeName(row.nome)));
  const synced = [];
  const skipped = [];
  const repaired = [];
  const updated = [];

  async function uploadTemplateFile(row, file) {
    const sourcePath = path.join(sourceDir, file);
    const buffer = fs.readFileSync(sourcePath);
    let storagePath = storagePathFromRef(row.arquivoPath);

    if (!storagePath) {
      storagePath = `${templatePrefix}/bulk_${Date.now()}_${safeStorageFileName(file)}`;
      await pool.query(
        'update "Template" set "arquivoPath"=$1 where "id"=$2',
        [`supabase://${bucket}/${storagePath}`, row.id]
      );
    }

    const upload = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
    if (upload.error) throw new Error(`Falha ao atualizar ${file}: ${upload.error.message}`);
    updated.push(row.nome);
  }

  for (const file of files) {
    const nome = displayName(file);
    const key = normalizeName(nome);
    const safeFile = safeStorageFileName(file);
    const matchingRows = existingRowsList.filter((row) =>
      normalizeName(row.nome) === key || storageBaseName(row.arquivoPath).endsWith(safeFile)
    );

    if (matchingRows.length > 0) {
      const exactRow = matchingRows.find((row) => row.nome === nome);
      const { tipo, padraoHeader } = inferMeta(file);
      const processingType = detectProcessingType(file);

      if (exactRow) {
        await uploadTemplateFile(exactRow, file);
        await pool.query(
          'update "Template" set "tipo"=$1, "padraoHeader"=$2, "processingType"=$3, "ativo"=true where "id"=$4',
          [tipo, padraoHeader, processingType, exactRow.id]
        );

        for (const row of matchingRows) {
          if (row.id === exactRow.id) continue;
          const refs = await pool.query('select count(*)::int as count from "DocumentoGerado" where "templateId"=$1', [row.id]);
          if (refs.rows[0].count === 0) {
            await pool.query('delete from "Template" where "id"=$1', [row.id]);
          } else {
            await pool.query('update "Template" set "nome"=$1, "ativo"=false where "id"=$2', [`${nome} (duplicado antigo)`, row.id]);
          }
          repaired.push(`${row.nome} -> removido/ocultado`);
        }
      } else {
        const [primary, ...duplicates] = matchingRows;
        await uploadTemplateFile(primary, file);
        await pool.query(
          'update "Template" set "nome"=$1, "tipo"=$2, "padraoHeader"=$3, "processingType"=$4 where "id"=$5',
          [nome, tipo, padraoHeader, processingType, primary.id]
        );
        repaired.push(`${primary.nome} -> ${nome}`);

        for (const row of duplicates) {
          const refs = await pool.query('select count(*)::int as count from "DocumentoGerado" where "templateId"=$1', [row.id]);
          if (refs.rows[0].count === 0) {
            await pool.query('delete from "Template" where "id"=$1', [row.id]);
          } else {
            await pool.query('update "Template" set "nome"=$1, "ativo"=false where "id"=$2', [`${nome} (duplicado antigo)`, row.id]);
          }
          repaired.push(`${row.nome} -> removido/ocultado`);
        }
      }

      existing.add(key);
      skipped.push(nome);
      continue;
    }

    if (existing.has(key)) {
      skipped.push(nome);
      continue;
    }

    const storageName = `bulk_${Date.now()}_${safeFile}`;
    const storagePath = `${templatePrefix}/${storageName}`;
    const buffer = fs.readFileSync(path.join(sourceDir, file));
    const upload = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
    if (upload.error) throw new Error(`Falha ao subir ${file}: ${upload.error.message}`);

    const { tipo, padraoHeader } = inferMeta(file);
    const processingType = detectProcessingType(file);
    await pool.query(
      'insert into "Template" ("id", "nome", "tipo", "padraoHeader", "processingType", "arquivoPath", "ativo", "criadoEm") values ($1,$2,$3,$4,$5,$6,true,now())',
      [crypto.randomUUID(), nome, tipo, padraoHeader, processingType, `supabase://${bucket}/${storagePath}`]
    );
    existing.add(key);
    synced.push(nome);
  }

  const count = await pool.query('select count(*)::int as count from "Template"');
  await pool.end();
  console.log(JSON.stringify({ local: files.length, skipped: skipped.length, updated: updated.length, repaired, synced, remote: count.rows[0].count }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
