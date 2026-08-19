import { randomBytes } from "node:crypto";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

import { BASE_URL, IS_REMOTE } from "./environment";

const root = path.resolve(__dirname, "..", "..");

// Mesma ordem que `scripts/generate-prisma.js`: o `.env.local` manda sobre o
// `.env`. Carregar aqui é o que permite rodar a suíte contra a configuração real
// da máquina quando ela existe, sem que nenhum valor precise ser repetido.
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

/**
 * Preenche uma variável só quando ela ainda não existe. É assim que a suíte roda
 * numa máquina sem configuração nenhuma sem sobrescrever a configuração de quem
 * tem a de verdade.
 */
function fallback(name: string, value: string): void {
  if (!process.env[name]?.trim()) process.env[name] = value;
}

// Segredo efêmero, gerado a cada execução e nunca gravado em disco: o servidor
// local precisa assinar o plano do planner, e um valor fixo no repositório seria
// um segredo publicado.
fallback("PLANNER_SIGNING_SECRET", randomBytes(32).toString("hex"));

// Sem Supabase configurado, o middleware devolve 503 em vez de mandar para o
// login — e a fronteira anônima passaria a ser testada contra um comportamento
// que produção não tem. Estes valores não autenticam ninguém: apontam para uma
// porta fechada, então `getUser()` nunca acha sessão e o anônimo é barrado como
// em produção.
fallback("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
fallback("NEXT_PUBLIC_SUPABASE_ANON_KEY", "e2e-placeholder-sem-valor-de-credencial");

const port = Number(new URL(BASE_URL).port || 3100);

export default defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: path.join(root, "playwright-report"), open: "never" }]],
  outputDir: path.join(root, "test-results"),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: IS_REMOTE
    ? undefined
    : {
        command: `npx next dev --port ${port}`,
        // A espera é pelo `/planner`, e não pelo `/api/health`: numa máquina de
        // desenvolvimento a saúde é 503 legítimo — falta chave da Anthropic e
        // banco Postgres —, então esperar 200 ali travaria a suíte para sempre.
        url: `${BASE_URL}/planner`,
        cwd: root,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
