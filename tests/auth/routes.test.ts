import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as login, POST as loginPost } from "@/app/api/auth/login/route";
import { GET as callback } from "@/app/api/auth/callback/route";
import { GET as logoutGet, POST as logout } from "@/app/api/auth/logout/route";
import { OIDC_FLOW_COOKIE, SESSION_COOKIE, signFlow } from "@/lib/auth/session";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "segredo-de-teste-com-mais-de-32-caracteres");
  vi.stubEnv("OIDC_ISSUER", "https://login.example.test/realms/treinavisa");
  vi.stubEnv("OIDC_CLIENT_ID", "pastavisa");
  vi.stubEnv("OIDC_CLIENT_SECRET", "segredo-do-client");
  vi.stubEnv("APP_URL", "https://pasta.example.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("auth routes", () => {
  it("login manda para o Keycloak com PKCE e guarda o fluxo", async () => {
    const response = await login(new NextRequest("https://pasta.example.test/api/auth/login?next=%2Fpasta%2F1"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe(
      "https://login.example.test/realms/treinavisa/protocol/openid-connect/auth"
    );
    expect(location.searchParams.get("client_id")).toBe("pastavisa");
    expect(location.searchParams.get("redirect_uri")).toBe("https://pasta.example.test/api/auth/callback");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(response.cookies.get(OIDC_FLOW_COOKIE)?.value).toBeTruthy();
  });

  it("login indisponivel sem configuracao", async () => {
    vi.stubEnv("OIDC_CLIENT_SECRET", "");
    expect((await login(new NextRequest("https://pasta.example.test/api/auth/login"))).status).toBe(503);
  });

  it("login por senha foi desligado", async () => {
    expect((await loginPost()).status).toBe(410);
  });

  it("callback recusa state diferente sem abrir sessao", async () => {
    const req = new NextRequest("https://pasta.example.test/api/auth/callback?code=abc&state=outro");
    req.cookies.set(OIDC_FLOW_COOKIE, await signFlow({ state: "certo", verifier: "v", next: "/" }));
    const response = await callback(req);
    expect(response.headers.get("location")).toContain("/login?erro=expirado");
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBeFalsy();
  });

  it("callback trata cancelamento no Keycloak", async () => {
    const response = await callback(
      new NextRequest("https://pasta.example.test/api/auth/callback?error=access_denied&state=x")
    );
    expect(response.headers.get("location")).toContain("/login?erro=cancelado");
  });

  it("logout limpa a sessao e sai do Keycloak", async () => {
    const req = new NextRequest("https://pasta.example.test/api/auth/logout");
    const response = await logoutGet(req);
    expect(response.headers.get("location")).toContain("/protocol/openid-connect/logout");
    expect(response.headers.get("location")).toContain(
      "post_logout_redirect_uri=https%3A%2F%2Fpasta.example.test%2Flogin"
    );
    const post = await logout(new NextRequest("https://pasta.example.test/api/auth/logout", { method: "POST" }));
    expect(post.status).toBe(200);
    expect(post.headers.get("cache-control")).toBe("private, no-store");
  });
});
