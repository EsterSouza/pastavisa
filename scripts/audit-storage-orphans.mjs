#!/usr/bin/env node
/**
 * Auditoria — e, sob pedido explícito, limpeza — de arquivos órfãos no Supabase
 * Storage (PV-026).
 *
 * Órfão é o objeto que nenhuma linha do banco referencia. Ele não aparece em
 * tela nenhuma, não pode ser baixado por ninguém e mesmo assim ocupa cota e
 * mantém documento de cliente guardado.
 *
 * Duas fontes de órfão, ambas medidas em 19/08/2026:
 *   1. `DELETE /api/pastas/[id]` apaga as saídas e deixa o arquivo que o cliente
 *      enviou — `deleteGeneratedDocx` só remove sob `storage/output`.
 *   2. A exclusão em lote de documentos de correção faz o mesmo, e está
 *      documentada em comentário na própria rota.
 *
 * Uso:
 *   node scripts/audit-storage-orphans.mjs --env .env.producao              # só relatório
 *   node scripts/audit-storage-orphans.mjs --env .env.producao --manifesto  # grava a lista
 *   node scripts/audit-storage-orphans.mjs --env .env.producao --apply      # apaga
 *
 * Precisa de DATABASE_URL e SUPABASE_SERVICE_ROLE_KEY. O jeito curto de obtê-los
 * é `npx vercel env pull .env.producao --environment=production`, que traz os
 * dois sem ninguém copiar segredo à mão.
 *
 * **Use um arquivo separado, não o `.env.local`.** Com `DATABASE_URL` de produção
 * no `.env.local`, o `next dev` desta máquina deixa de usar o SQLite e passa a
 * escrever no banco de produção — inclusive a suíte E2E.
 *
 * Sem `--apply` nada é removido: o padrão é sempre a leitura.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import dotenv from "dotenv";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

// Arquivo de ambiente extra, para manter o segredo de produção fora do
// `.env.local` que o servidor de desenvolvimento lê.
const envIndex = process.argv.indexOf("--env");
if (envIndex !== -1) {
  const arquivo = process.argv[envIndex + 1];
  if (!arquivo) {
    console.error("--env exige o caminho do arquivo, por exemplo: --env .env.producao");
    process.exit(1);
  }
  const caminho = path.resolve(root, arquivo);
  if (!fs.existsSync(caminho)) {
    console.error(`Arquivo de ambiente nao encontrado: ${arquivo}`);
    process.exit(1);
  }
  dotenv.config({ path: caminho, override: true });
}

const APPLY = process.argv.includes("--apply");
const MANIFESTO = process.argv.includes("--manifesto") || APPLY;
// O acervo de templates é o insumo de toda pasta gerada. Um órfão ali é quase
// sempre upload em andamento, não lixo, então ele fica de fora por padrão.
const INCLUIR_TEMPLATES = process.argv.includes("--incluir-templates");

// Um upload em andamento existe no Storage antes de a linha do banco ser
// gravada. Sem este piso, uma corrida de segundos faria o arquivo recém-enviado
// de um cliente parecer órfão — e ser apagado.
const idadeIndex = process.argv.indexOf("--idade-minima-horas");
const IDADE_MINIMA_HORAS = idadeIndex === -1 ? 24 : Number(process.argv[idadeIndex + 1]);
if (!Number.isFinite(IDADE_MINIMA_HORAS) || IDADE_MINIMA_HORAS < 0) {
  console.error("--idade-minima-horas exige um número de horas.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pasta-visa";

if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
  console.error(
    "Defina DATABASE_URL, SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}
if (!databaseUrl.startsWith("postgres")) {
  console.error("DATABASE_URL precisa apontar para o Postgres do Supabase, não para o SQLite local.");
  process.exit(1);
}

function mb(bytes) {
  return `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`;
}

/** Toda coluna do schema que guarda caminho de arquivo. Faltar uma aqui apaga arquivo em uso. */
const COLUNAS_DE_CAMINHO = [
  ['"DocumentoGerado"', '"outputPath"'],
  ['"DocumentoVersao"', '"outputPath"'],
  ['"DocumentoUpload"', '"uploadPath"'],
  ['"DocumentoUpload"', '"outputPath"'],
  ['"DocumentoUploadVersao"', '"outputPath"'],
  ['"Pasta"', '"formsPdfPath"'],
  ['"Pasta"', '"documentosElaboracaoPath"'],
  ['"Pasta"', '"clienteLogoPath"'],
  ['"Template"', '"arquivoPath"'],
  ['"TemplateVersao"', '"arquivoPath"'],
];

const SQL_REFERENCIADOS = COLUNAS_DE_CAMINHO.map(
  ([tabela, coluna]) =>
    `select replace(${coluna}, 'supabase://${bucket}/', '') as caminho from ${tabela} where ${coluna} is not null`
).join("\n  union\n  ");

const SQL_OBJETOS = `
  select name, (metadata->>'size')::bigint as bytes, created_at
  from storage.objects
  where bucket_id = $1
`;

/**
 * Confere que o schema é o esperado antes de qualquer coisa. Se alguém
 * acrescentar uma coluna de caminho e esquecer deste script, um arquivo em uso
 * passaria a parecer órfão — e seria apagado. Aqui isso vira parada, não perda.
 */
async function conferirSchema(client) {
  const { rows } = await client.query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (column_name ilike '%path%' or column_name ilike '%arquivo%')
      and column_name not ilike 'nomeArquivo'
  `);
  const encontradas = rows
    .map((r) => `"${r.table_name}"."${r.column_name}"`)
    .sort();
  const conhecidas = COLUNAS_DE_CAMINHO.map(([t, c]) => `${t}.${c}`).sort();

  const novas = encontradas.filter((coluna) => !conhecidas.includes(coluna));
  if (novas.length) {
    console.error("PARADO: o schema tem coluna de caminho que este script não conhece:");
    novas.forEach((coluna) => console.error(`  ${coluna}`));
    console.error("Acrescente-a em COLUNAS_DE_CAMINHO antes de rodar de novo.");
    process.exit(1);
  }
}

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await conferirSchema(client);

    const [{ rows: refs }, { rows: objetos }] = [
      await client.query(SQL_REFERENCIADOS),
      await client.query(SQL_OBJETOS, [bucket]),
    ];
    const referenciados = new Set(refs.map((r) => r.caminho));
    const pastas = new Set((await client.query('select id from "Pasta"')).rows.map((r) => r.id));

    const grupos = new Map();
    const orfaos = [];
    let totalBytes = 0n;

    for (const objeto of objetos) {
      const bytes = BigInt(objeto.bytes ?? 0);
      totalBytes += bytes;
      const area = objeto.name.split("/")[1] || "(raiz)";

      if (referenciados.has(objeto.name)) {
        acumular(grupos, `${area}: em uso`, bytes);
        continue;
      }

      // O nome do upload começa pelo id da pasta, então dá para separar o que
      // sobrou de pasta excluída — que além de espaço é retenção de dado — do
      // que sobrou de documento excluído numa pasta viva.
      const prefixo = objeto.name.replace(`storage/${area}/`, "").split("_")[0];
      const daPastaViva = pastas.has(prefixo);
      const rotulo =
        area === "uploads"
          ? daPastaViva
            ? "uploads: órfão, pasta ainda existe"
            : "uploads: órfão, pasta já excluída"
          : `${area}: órfão`;

      const horas = (Date.now() - new Date(objeto.created_at).getTime()) / 3_600_000;
      const recente = horas < IDADE_MINIMA_HORAS;
      acumular(grupos, recente ? `${rotulo} (recente, preservado)` : rotulo, bytes);
      if (recente) continue;
      if (area !== "templates" || INCLUIR_TEMPLATES) orfaos.push({ ...objeto, bytes });
    }

    console.log(`\nBucket ${bucket} — ${objetos.length} objetos, ${mb(totalBytes)}\n`);
    const linhas = [...grupos.entries()].sort((a, b) => Number(b[1].bytes - a[1].bytes));
    for (const [rotulo, dados] of linhas) {
      console.log(`  ${String(dados.objetos).padStart(5)} objetos  ${mb(dados.bytes).padStart(10)}  ${rotulo}`);
    }

    const bytesOrfaos = orfaos.reduce((soma, o) => soma + o.bytes, 0n);
    console.log(
      `\n  Órfãos elegíveis: ${orfaos.length} objetos, ${mb(bytesOrfaos)} ` +
        `(${((Number(bytesOrfaos) / Number(totalBytes || 1n)) * 100).toFixed(0)}% do bucket)`
    );
    if (!INCLUIR_TEMPLATES) console.log("  Órfãos em templates/ ficaram de fora; use --incluir-templates.");
    console.log(`  Órfão com menos de ${IDADE_MINIMA_HORAS}h fica de fora: pode ser envio em andamento.`);

    if (MANIFESTO && orfaos.length) {
      // O manifesto tem nome de arquivo de cliente. Vai para caminho ignorado
      // pelo git, e nunca para commit, handoff ou log (regra 6).
      const destino = path.join(root, `orfaos-${new Date().toISOString().slice(0, 10)}.txt`);
      fs.writeFileSync(destino, orfaos.map((o) => o.name).join("\n") + "\n", "utf8");
      console.log(`\n  Manifesto gravado em ${path.basename(destino)} (ignorado pelo git).`);
    }

    if (!APPLY) {
      console.log("\n  Nada foi removido. Rode de novo com --apply para apagar.\n");
      return;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let removidos = 0;
    for (let i = 0; i < orfaos.length; i += 100) {
      const lote = orfaos.slice(i, i + 100).map((o) => o.name);
      const { error } = await supabase.storage.from(bucket).remove(lote);
      if (error) throw new Error(`Falha ao remover lote ${i / 100 + 1}: ${error.message}`);
      removidos += lote.length;
      console.log(`  removidos ${removidos}/${orfaos.length}`);
    }
    console.log(`\n  ${removidos} objetos removidos, ${mb(bytesOrfaos)} liberados.\n`);
  } finally {
    await client.end();
  }
}

function acumular(mapa, rotulo, bytes) {
  const atual = mapa.get(rotulo) || { objetos: 0, bytes: 0n };
  mapa.set(rotulo, { objetos: atual.objetos + 1, bytes: atual.bytes + bytes });
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
