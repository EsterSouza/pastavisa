import { storageDriver } from "./file-storage";
import { isOidcConfigured } from "./auth/oidc";

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  message: string;
}

function hasEnv(name: string): boolean {
  return !!process.env[name]?.trim();
}

function hasS3Env(): boolean {
  return hasEnv("S3_ENDPOINT") && hasEnv("S3_ACCESS_KEY_ID") && hasEnv("S3_SECRET_ACCESS_KEY");
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
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
        ? "Banco Postgres configurado"
        : "Usando banco local; configure DATABASE_URL (Postgres da infra) para producao",
    },
    {
      name: "storage",
      ok: (driver === "s3" && hasS3Env()) || (driver === "local" && !isProductionRuntime()),
      message: driver === "s3"
        ? "Storage S3 (Garage) configurado"
        : isProductionRuntime()
        ? "Storage local nao serve em producao; configure S3_ENDPOINT e as chaves do Garage"
        : "Usando storage local; configure FILE_STORAGE_DRIVER=s3 para producao",
    },
    {
      name: "authentication",
      ok: isOidcConfigured(),
      message: "Login pelo Keycloak (OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, APP_URL, SESSION_SECRET)",
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
