const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(root, "backups", `local-${stamp}`);
const dbPath = path.join(root, "prisma", "dev.db");
const storagePath = path.join(root, "storage");

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.cpSync(from, to, { recursive: true });
  return true;
}

function readTable(db, table) {
  return db.prepare(`SELECT * FROM "${table}"`).all();
}

fs.mkdirSync(backupDir, { recursive: true });

const copiedDb = copyIfExists(dbPath, path.join(backupDir, "dev.db"));
const copiedStorage = copyIfExists(storagePath, path.join(backupDir, "storage"));

let exportData = {
  createdAt: new Date().toISOString(),
  sourceRoot: root,
  files: {
    database: copiedDb ? "dev.db" : null,
    storage: copiedStorage ? "storage" : null,
  },
  tables: {},
};

if (fs.existsSync(dbPath)) {
  const db = new Database(dbPath, { readonly: true });
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => row.name);

  for (const table of tables) {
    exportData.tables[table] = readTable(db, table);
  }
  db.close();
}

fs.writeFileSync(
  path.join(backupDir, "export.json"),
  JSON.stringify(exportData, null, 2),
  "utf8"
);

console.log(`Backup criado em: ${backupDir}`);
console.log(`Banco copiado: ${copiedDb ? "sim" : "nao"}`);
console.log(`Storage copiado: ${copiedStorage ? "sim" : "nao"}`);
