import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  })),
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

function loginRequest(body: unknown) {
  return new NextRequest("https://pastavisa.test/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("auth routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("faz login com email e senha para papel valido", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { app_metadata: { role: "admin" } } },
      error: null,
    });

    const response = await login(loginRequest({ email: "admin@example.test", password: "secret" }));
    expect(response.status).toBe(200);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.test",
      password: "secret",
    });
  });

  it("retorna 401 para credenciais invalidas", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    expect((await login(loginRequest({ email: "qa@example.test", password: "invalid" }))).status).toBe(401);
  });

  it("encerra sessao sem expor estado", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    const response = await logout();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
