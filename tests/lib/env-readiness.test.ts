import { afterEach, describe, expect, it, vi } from "vitest";
import { getReadinessSummary } from "@/lib/env-readiness";

const readinessEnvironment = [
  "ANTHROPIC_API_KEY",
  "DATABASE_URL",
  "FILE_STORAGE_DRIVER",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL",
  "APP_BASIC_AUTH_USER",
  "APP_BASIC_AUTH_PASSWORD",
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
        { name: "access_gate", ok: true },
      ],
    });
  });

  it("accepts a fully configured production matrix", () => {
    setReadinessEnvironment({
      NODE_ENV: "production",
      ANTHROPIC_API_KEY: "configured",
      DATABASE_URL: "postgres",
      FILE_STORAGE_DRIVER: "supabase",
      SUPABASE_URL: "configured",
      SUPABASE_SERVICE_ROLE_KEY: "configured",
      APP_BASIC_AUTH_USER: "configured",
      APP_BASIC_AUTH_PASSWORD: "configured",
    });

    expect(getReadinessSummary()).toMatchObject({
      ok: true,
      checks: [
        { name: "anthropic", ok: true },
        { name: "database", ok: true },
        { name: "storage", ok: true },
        { name: "access_gate", ok: true },
      ],
    });
  });
});
