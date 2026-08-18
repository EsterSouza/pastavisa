// seed/run.ts
// Popula a tabela Legislacao com todas as referências validadas.
// Uso: npx tsx seed/run.ts
//
// Usa better-sqlite3 diretamente (sem adapter Prisma 7) para
// não depender de alias @/ ou da inicialização do servidor Next.js.

import path from "path";
import { randomBytes } from "crypto";
import Database from "better-sqlite3";
import legislacoes from "./legislacoes";
import { criarChaveReferencia } from "../lib/reference-deduplication";

const DB_PATH = path.join(process.cwd(), "prisma", "dev.db");

function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(10).toString("base64url").slice(0, 14);
  return `c${timestamp}${random}`;
}

const db = new Database(DB_PATH);

// Garante que a tabela existe (segurança extra)
db.exec(`
  CREATE TABLE IF NOT EXISTS "Legislacao" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "estadoUf"       TEXT NOT NULL,
    "municipio"      TEXT,
    "tipo"           TEXT NOT NULL,
    "titulo"         TEXT NOT NULL,
    "referenciaAbnt" TEXT NOT NULL,
    "ativo"          INTEGER NOT NULL DEFAULT 1,
    "chaveReferencia" TEXT
  )
`);
try {
  db.exec(`ALTER TABLE "Legislacao" ADD COLUMN "chaveReferencia" TEXT`);
} catch {
  // Column already exists.
}
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "Legislacao_chaveReferencia_key" ON "Legislacao"("chaveReferencia")`);

const insert = db.prepare(`
  INSERT INTO "Legislacao" ("id","estadoUf","municipio","tipo","titulo","referenciaAbnt","chaveReferencia","ativo")
  VALUES (@id, @estadoUf, @municipio, @tipo, @titulo, @referenciaAbnt, @chaveReferencia, 1)
`);

// Casa pela chave de referência, não pelo título: a unificação renomeou atos
// ("RDC nº 222/2018 — PGRSS" virou "RDC Anvisa nº 222/2018") e casar por título
// faria o seed tentar inserir de novo uma norma que já está lá, batendo no
// índice único de chaveReferencia. O título antigo continua sendo reconhecido
// enquanto a linha não tiver chave gravada.
const findByKey = db.prepare(
  `SELECT id FROM "Legislacao" WHERE "chaveReferencia" = @chaveReferencia`
);
// O título é o segundo caminho de casamento, e vale mesmo quando a linha já tem
// chave: corrigir o algoritmo de chaveReferencia invalida as chaves gravadas, e
// sem esta busca o seed reinseriria a base inteira em duplicata.
const findByTitulo = db.prepare(
  `SELECT id FROM "Legislacao" WHERE titulo = @titulo ORDER BY ("chaveReferencia" IS NULL) LIMIT 1`
);
const irmasComMesmoTitulo = db.prepare(
  `SELECT id FROM "Legislacao" WHERE titulo = @titulo AND id <> @id`
);
const apagar = db.prepare(`DELETE FROM "Legislacao" WHERE id = @id`);
const refresh = db.prepare(
  `UPDATE "Legislacao"
      SET "chaveReferencia" = @chaveReferencia,
          "titulo"          = @titulo,
          "referenciaAbnt"  = @referenciaAbnt,
          "estadoUf"        = @estadoUf,
          "municipio"       = @municipio,
          "tipo"            = @tipo
    WHERE id = @id`
);

// Ids citados por alguma pasta: essas linhas não podem sumir, mesmo duplicadas,
// senão a pasta perde a referência que já associou.
const emUso = new Set<string>();
for (const row of db.prepare(`SELECT legislacaoIds FROM "Pasta" WHERE legislacaoIds IS NOT NULL`).all() as { legislacaoIds: string }[]) {
  try {
    const ids = JSON.parse(row.legislacaoIds);
    if (Array.isArray(ids)) ids.forEach((id) => emUso.add(String(id)));
  } catch {
    row.legislacaoIds.split(",").forEach((id) => emUso.add(id.trim()));
  }
}

let inseridos = 0;
let atualizados = 0;
let removidos = 0;
let duplicadasEmUso = 0;

const runAll = db.transaction(() => {
  for (const leg of legislacoes) {
    const chaveReferencia = criarChaveReferencia(leg);
    const linha = {
      estadoUf: leg.estadoUf,
      municipio: leg.municipio ?? null,
      tipo: leg.tipo,
      titulo: leg.titulo,
      referenciaAbnt: leg.referenciaAbnt,
      chaveReferencia,
    };

    const existing =
      findByKey.get({ chaveReferencia }) || findByTitulo.get({ titulo: leg.titulo });

    if (existing) {
      const id = (existing as { id: string }).id;
      refresh.run({ ...linha, id });
      atualizados++;

      // Duplicatas do mesmo ato deixadas por uma execução anterior com outro
      // algoritmo de chave. Some com as que ninguém referenciou.
      for (const irma of irmasComMesmoTitulo.all({ titulo: leg.titulo, id }) as { id: string }[]) {
        if (emUso.has(irma.id)) {
          duplicadasEmUso++;
          continue;
        }
        apagar.run({ id: irma.id });
        removidos++;
      }
      continue;
    }

    insert.run({ ...linha, id: cuid() });
    inseridos++;
  }
});

runAll();
db.close();

console.log(
  `\n✓ Seed concluído: ${inseridos} inseridas, ${atualizados} atualizadas, ${removidos} duplicatas removidas.`
);
if (duplicadasEmUso > 0) {
  console.log(
    `  ⚠ ${duplicadasEmUso} duplicata(s) mantida(s) por estarem associadas a alguma pasta. Reassocie a pasta e rode de novo.`
  );
}
console.log(`  Total no arquivo: ${legislacoes.length} legislações.\n`);
