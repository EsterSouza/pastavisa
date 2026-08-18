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
const findByTitulo = db.prepare(
  `SELECT id FROM "Legislacao" WHERE titulo = @titulo AND "chaveReferencia" IS NULL`
);
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

let inseridos = 0;
let atualizados = 0;

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
      refresh.run({ ...linha, id: (existing as { id: string }).id });
      atualizados++;
      continue;
    }

    insert.run({ ...linha, id: cuid() });
    inseridos++;
  }
});

runAll();
db.close();

console.log(`\n✓ Seed concluído: ${inseridos} inseridas, ${atualizados} atualizadas.`);
console.log(`  Total no arquivo: ${legislacoes.length} legislações.\n`);
