import path from "path";
import fs from "fs";

export function ensureDatabase() {
  const dbPath = path.join(process.cwd(), "prisma", "dev.db");
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

  if (!fs.existsSync(migrationsDir)) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const db = new Database(dbPath);

  // Create migrations tracking table if it doesn't exist
  db.exec(`CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY)`);

  // Find and apply all pending migrations in order
  const migrationFolders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  for (const folder of migrationFolders) {
    const sqlPath = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    const applied = db
      .prepare("SELECT name FROM _applied_migrations WHERE name = ?")
      .get(folder);

    if (!applied) {
      try {
        const sql = fs.readFileSync(sqlPath, "utf8");
        db.exec(sql);
        db.prepare("INSERT OR IGNORE INTO _applied_migrations (name) VALUES (?)").run(folder);
        console.log(`[db-init] Migração aplicada: ${folder}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists")) {
          // Tables already exist (e.g. created via prisma db push) — mark as applied silently.
          db.prepare("INSERT OR IGNORE INTO _applied_migrations (name) VALUES (?)").run(folder);
        } else {
          console.error(`[db-init] Erro na migração ${folder}:`, err);
        }
      }
    }
  }

  db.close();
}
