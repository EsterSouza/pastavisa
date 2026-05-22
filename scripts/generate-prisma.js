const { spawnSync } = require("child_process");
const path = require("path");
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const databaseUrl = process.env.DATABASE_URL || "";
const schema = databaseUrl.startsWith("postgres")
  ? "prisma/schema.supabase.prisma"
  : "prisma/schema.prisma";
const prismaBin = process.platform === "win32"
  ? path.join(process.cwd(), "node_modules", ".bin", "prisma.cmd")
  : path.join(process.cwd(), "node_modules", ".bin", "prisma");

console.log(`Gerando Prisma Client com ${schema}`);

const command = process.platform === "win32" ? "cmd.exe" : prismaBin;
const args = process.platform === "win32"
  ? ["/c", prismaBin, "generate", "--schema", schema]
  : ["generate", "--schema", schema];

const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
