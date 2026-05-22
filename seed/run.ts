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
    "ativo"          INTEGER NOT NULL DEFAULT 1
  )
`);

const insert = db.prepare(`
  INSERT INTO "Legislacao" ("id","estadoUf","municipio","tipo","titulo","referenciaAbnt","ativo")
  VALUES (@id, @estadoUf, @municipio, @tipo, @titulo, @referenciaAbnt, 1)
`);

const checkExists = db.prepare(
  `SELECT id FROM "Legislacao" WHERE titulo = @titulo`
);

let inseridos = 0;
let jaExistiam = 0;

const runAll = db.transaction(() => {
  for (const leg of legislacoes) {
    const existing = checkExists.get({ titulo: leg.titulo });
    if (existing) {
      jaExistiam++;
      continue;
    }
    insert.run({
      id: cuid(),
      estadoUf: leg.estadoUf,
      municipio: leg.municipio ?? null,
      tipo: leg.tipo,
      titulo: leg.titulo,
      referenciaAbnt: leg.referenciaAbnt,
    });
    inseridos++;
  }
});

runAll();
db.close();

console.log(`\n✓ Seed concluído: ${inseridos} inseridas, ${jaExistiam} já existiam.`);
console.log(`  Total no arquivo: ${legislacoes.length} legislações.\n`);
