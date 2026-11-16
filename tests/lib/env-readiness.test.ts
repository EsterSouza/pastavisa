import { afterEach, describe, expect, it, vi } from "vitest";
import { getReadinessSummary } from "@/lib/env-readiness";

const readinessEnvironment = [
  "ANTHROPIC_API_KEY",
  "DATABASE_URL",
  "FILE_STORAGE_DRIVER",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "OIDC_ISSUER",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "APP_URL",
  "SESSION_SECRET",
  "PLANNER_SIGNING_SECRET",
] as const;

function setReadinessEnvironment(overrides: Record<string, string> = {}) {
  vi.stubEnv("NODE_ENV", overrides.NODE_ENV ?? "test");

  for (const name of readinessEnvironment) {
    vi.stubEnv(name, overrides[name] ?? "");
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("getReadinessSummary", () => {
  it("reports the local development matrix without requiring production settings", () => {
    setReadinessEnvironment();

    expect(getReadinessSummary()).toMatchObject({
      ok: false,
      checks: [
        { name: "anthropic", ok: false },
        { name: "database", ok: true },
        { name: "storage", ok: true },
        { name: "authentication", ok: false },
        { name: "planner-signing", ok: false },
      ],
    });
  });

  it("accepts a fully configured production matrix", () => {
    setReadinessEnvironment({
      NODE_ENV: "production",
      ANTHROPIC_API_KEY: "configured",
      DATABASE_URL: "postgres",
      FILE_STORAGE_DRIVER: "s3",
      S3_ENDPOINT: "https://storage.example.test",
      S3_ACCESS_KEY_ID: "configured",
      S3_SECRET_ACCESS_KEY: "configured",
      OIDC_ISSUER: "https://login.example.test/realms/treinavisa",
      OIDC_CLIENT_ID: "pastavisa",
      OIDC_CLIENT_SECRET: "configured",
      APP_URL: "https://pasta.example.test",
      SESSION_SECRET: "segredo-de-teste-com-mais-de-32-caracteres",
      PLANNER_SIGNING_SECRET: "configured",
    });

    expect(getReadinessSummary()).toMatchObject({
      ok: true,
      checks: [
        { name: "anthropic", ok: true },
        { name: "database", ok: true },
        { name: "storage", ok: true },
        { name: "authentication", ok: true },
        { name: "planner-signing", ok: true },
      ],
    });
  });
});
