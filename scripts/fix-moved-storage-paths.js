const Database = require("better-sqlite3");

const db = new Database("prisma/dev.db");
const cwd = process.cwd();
const oldRoots = [
  "C:\\Users\\miche\\OneDrive - MSFT\\TreinaVISA\\Criador de pasta sanitária\\pastavirus",
  "C:\\Users\\enfes\\OneDrive - MSFT\\TreinaVISA\\Criador de pasta sanitária\\pastavirus",
];

function fixPath(value) {
  if (typeof value !== "string") return value;
  for (const oldRoot of oldRoots) {
    if (value.startsWith(oldRoot)) {
      return cwd + value.slice(oldRoot.length);
    }
  }
  return value;
}

const updates = [
  ["Template", "arquivoPath"],
  ["DocumentoGerado", "outputPath"],
  ["Pasta", "clienteLogoPath"],
  ["Pasta", "formsPdfPath"],
  ["Pasta", "documentosElaboracaoPath"],
];

let totalPathUpdates = 0;

for (const [table, column] of updates) {
  const rows = db
    .prepare(`SELECT id, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL`)
    .all();
  const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`);
  let count = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      const next = fixPath(row.value);
      if (next !== row.value) {
        update.run(next, row.id);
        count += 1;
        totalPathUpdates += 1;
      }
    }
  });

  tx();
  console.log(`${table}.${column}: ${count}`);
}

const resetErroDocs = db
  .prepare(
    `UPDATE DocumentoGerado
     SET status = 'pendente',
         mensagemErro = NULL,
         tokensUsados = NULL,
         outputPath = NULL
     WHERE status = 'erro'
       AND mensagemErro LIKE '%OneDrive%'
       AND mensagemErro LIKE '%ENOENT%'`
  )
  .run();

console.log(`resetErroDocs: ${resetErroDocs.changes}`);
console.log(`totalPathUpdates: ${totalPathUpdates}`);

db.close();
