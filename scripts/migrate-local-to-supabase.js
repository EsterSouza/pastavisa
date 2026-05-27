const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { Pool } = require("pg");
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const root = process.cwd();
const localDbPath = process.env.LOCAL_SQLITE_PATH
  ? path.resolve(process.env.LOCAL_SQLITE_PATH)
  : path.join(root, "prisma", "dev.db");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !databaseUrl.startsWith("postgres")) {
  console.error("Defina DATABASE_URL com a connection string Postgres do Supabase.");
  process.exit(1);
}

if (!fs.existsSync(localDbPath)) {
  console.error(`Banco local nao encontrado: ${localDbPath}`);
  process.exit(1);
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function normalizeValue(table, column, value) {
  if (value == null) return null;
  const booleanColumns = new Set([
    "Template.ativo",
    "Legislacao.ativo",
    "DocumentoGerado.avisoRtNoCorpo",
    "DocumentoGerado.logoSubstituida",
    "DocumentoVersao.avisoRtNoCorpo",
    "DocumentoVersao.logoSubstituida",
  ]);
  if (booleanColumns.has(`${table}.${column}`)) return Boolean(value);
  return value;
}

async function ensureSchema(pool) {
  await pool.query(`
    create table if not exists "Pasta" (
      "id" text primary key,
      "status" text not null default 'rascunho',
      "criadaEm" timestamptz not null default now(),
      "clienteNomeFantasia" text,
      "clienteRazaoSocial" text,
      "clienteCnpj" text,
      "clienteEndereco" text,
      "clienteCidade" text,
      "clienteEstado" text,
      "clienteEstadoExtenso" text,
      "clienteTelefone" text,
      "clienteEmail" text,
      "clienteHorario" text,
      "clienteRtNome" text,
      "clienteRtProfissao" text,
      "clienteRtConselho" text,
      "clienteLogoPath" text,
      "clienteEstrutura" text,
      "clienteMemorialDescritivoMbp" text,
      "clienteServicos" text,
      "clienteFuncionarios" text,
      "clienteEquipamentos" text,
      "clienteTerceirizados" text,
      "clienteColetaRazao" text,
      "clienteColetaCnpj" text,
      "clienteResiduosA" text,
      "clienteResiduosD" text,
      "clienteResiduosE" text,
      "clienteInfoAdicionais" text,
      "docElaborador" text,
      "docMesExtenso" text,
      "docAno" text,
      "formsPdfPath" text,
      "documentosElaboracaoPath" text
    );

    create table if not exists "Template" (
      "id" text primary key,
      "nome" text not null,
      "tipo" text not null,
      "padraoHeader" text not null,
      "processingType" text not null default 'LIGHT_HAIKU',
      "arquivoPath" text not null,
      "ativo" boolean not null default true,
      "criadoEm" timestamptz not null default now()
    );

    create table if not exists "Legislacao" (
      "id" text primary key,
      "estadoUf" text not null,
      "municipio" text,
      "tipo" text not null,
      "titulo" text not null,
      "referenciaAbnt" text not null,
      "ativo" boolean not null default true
    );

    create table if not exists "DocumentoGerado" (
      "id" text primary key,
      "pastaId" text not null references "Pasta"("id") on delete cascade on update cascade,
      "templateId" text references "Template"("id") on delete set null on update cascade,
      "nomeArquivo" text not null,
      "outputPath" text,
      "status" text not null default 'pendente',
      "tokensUsados" integer,
      "mensagemErro" text,
      "avisoRtNoCorpo" boolean not null default false,
      "logoSubstituida" boolean not null default false,
      "equipamentosSelecionados" text,
      "criadoEm" timestamptz not null default now()
    );

    create table if not exists "DocumentoVersao" (
      "id" text primary key,
      "documentoId" text not null references "DocumentoGerado"("id") on delete cascade on update cascade,
      "outputPath" text not null,
      "tokensUsados" integer,
      "avisoRtNoCorpo" boolean not null default false,
      "logoSubstituida" boolean not null default false,
      "criadaEm" timestamptz not null default now()
    );

    create index if not exists "DocumentoVersao_documentoId_criadaEm_idx"
      on "DocumentoVersao" ("documentoId", "criadaEm");
  `);
}

async function upsertTable(pool, localDb, table) {
  const rows = localDb.prepare(`select * from ${quoteIdent(table)}`).all();
  if (rows.length === 0) {
    console.log(`${table}: 0 registros`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of rows) {
      const columns = Object.keys(row);
      const params = columns.map((column) => normalizeValue(table, column, row[column]));
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const updates = columns
        .filter((column) => column !== "id")
        .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
        .join(", ");
      const sql = `
        insert into ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")})
        values (${placeholders})
        on conflict ("id") do update set ${updates}
      `;
      await client.query(sql, params);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  console.log(`${table}: ${rows.length} registros migrados`);
}

async function main() {
  const localDb = new Database(localDbPath, { readonly: true });
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  await ensureSchema(pool);
  for (const table of ["Pasta", "Template", "Legislacao", "DocumentoGerado", "DocumentoVersao"]) {
    const exists = localDb.prepare(
      "select 1 from sqlite_master where type = 'table' and name = ?"
    ).get(table);
    if (!exists) continue;
    await upsertTable(pool, localDb, table);
  }

  localDb.close();
  await pool.end();
  console.log("Migracao local -> Supabase/Postgres concluida.");
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
