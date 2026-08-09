import { storageDriver } from "./file-storage";

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  message: string;
}

function hasEnv(name: string): boolean {
  return !!process.env[name]?.trim();
}

function hasSupabaseStorageEnv(): boolean {
  return (
    (hasEnv("SUPABASE_URL") || hasEnv("NEXT_PUBLIC_SUPABASE_URL")) &&
    hasEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
}

function hasSupabaseAuthEnv(): boolean {
  return (
    (hasEnv("NEXT_PUBLIC_SUPABASE_URL") || hasEnv("SUPABASE_URL")) &&
    (hasEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
      hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
      hasEnv("SUPABASE_ANON_KEY"))
  );
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || !!process.env.VERCEL;
}

export function getReadinessChecks(): ReadinessCheck[] {
  const driver = storageDriver();
  const checks: ReadinessCheck[] = [
    {
      name: "anthropic",
      ok: hasEnv("ANTHROPIC_API_KEY"),
      message: "ANTHROPIC_API_KEY configurada",
    },
    {
      name: "database",
      ok: hasEnv("DATABASE_URL") || process.env.NODE_ENV !== "production",
      message: hasEnv("DATABASE_URL") && process.env.DATABASE_URL?.startsWith("postgres")
        ? "Banco Supabase/Postgres configurado"
        : "Usando banco local; configure DATABASE_URL do Supabase para producao",
    },
    {
      name: "storage",
      ok:
        (driver === "supabase" && hasSupabaseStorageEnv()) ||
        (driver === "local" && !isProductionRuntime()),
      message: driver === "supabase"
        ? "Supabase Storage configurado"
        : isProductionRuntime()
        ? "Storage local nao atende uploads grandes em producao; configure Supabase Storage"
        : "Usando storage local; configure FILE_STORAGE_DRIVER=supabase para producao",
    },
    {
      name: "authentication",
      ok: hasSupabaseAuthEnv(),
      message: "Supabase Auth configurado com chave publicavel ou anon legada",
    },
    {
      name: "planner-signing",
      ok: hasEnv("PLANNER_SIGNING_SECRET"),
      message: "Assinatura temporaria do planner publico configurada",
    },
  ];

  return checks;
}

export function getReadinessSummary() {
  const checks = getReadinessChecks();
  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}
