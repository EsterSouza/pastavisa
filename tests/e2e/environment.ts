/**
 * Contrato de ambiente da suíte E2E (PV-012).
 *
 * Nenhuma credencial vive no repositório. Tudo que identifica uma conta ou um
 * segredo entra por variável de ambiente, e cada bloco de teste que depende de
 * uma delas se anuncia como pulado quando ela falta — em vez de passar em falso,
 * que é o modo silencioso de uma suíte de homologação enganar quem a lê.
 */

export interface QaAccount {
  email: string;
  password: string;
}

function account(prefix: string): QaAccount | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

/** Alvo da rodada. Sem esta variável, o Playwright sobe o servidor local. */
export const BASE_URL = (process.env.PV_E2E_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

/** Verdadeiro quando a rodada aponta para um ambiente publicado, não para o servidor local. */
export const IS_REMOTE = Boolean(process.env.PV_E2E_BASE_URL);

export const OPERADOR = account("PV_E2E_OPERADOR");
export const ADMIN = account("PV_E2E_ADMIN");

/**
 * A análise do planner consome uma chamada paga e é limitada pelo firewall a 10
 * requisições por IP a cada 5 minutos. Por isso ela só roda quando pedida.
 */
export const LIVE_ANALYSIS = process.env.PV_E2E_LIVE_ANALYSIS === "1";

export const SKIP_MESSAGES = {
  operador:
    "Defina PV_E2E_OPERADOR_EMAIL e PV_E2E_OPERADOR_PASSWORD para exercer o papel de operador.",
  admin: "Defina PV_E2E_ADMIN_EMAIL e PV_E2E_ADMIN_PASSWORD para exercer o papel de admin.",
  live:
    "Defina PV_E2E_LIVE_ANALYSIS=1 para rodar a análise real do planner (consome chamada paga).",
} as const;

/**
 * Marca tudo que a rodada cria como material de QA descartável. O prefixo é
 * conferido de novo na limpeza: nada é apagado sem que o nome comece por ele.
 */
export const QA_PREFIX = "QA-E2E";

export function qaLabel(sufixo: string): string {
  return `${QA_PREFIX} ${sufixo} ${Date.now()}`;
}
