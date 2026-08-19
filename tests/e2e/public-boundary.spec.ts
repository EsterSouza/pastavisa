import { expect, test, type APIRequestContext } from "@playwright/test";

import { BASE_URL } from "./environment";

/**
 * A fronteira anônima, exercida contra um servidor de verdade (PV-012).
 *
 * Os testes de unidade conferem `isPublicPath` como função; esta suíte confere o
 * que a aplicação **responde** quando ninguém está autenticado. É a diferença
 * entre a regra estar escrita e a regra estar valendo: um erro de `matcher` no
 * middleware passa em toda a suíte de unidade e abre a aplicação inteira.
 */

// Cada uma destas exige sessão. Página vai para o login; API responde 401.
const PAGINAS_INTERNAS = [
  "/",
  "/pasta/nova",
  "/templates",
  "/legislacoes",
];

const APIS_INTERNAS = [
  "/api/pastas",
  "/api/templates",
  "/api/legislacoes",
];

// Formato literal de segredo — é assim que ele apareceria numa resposta ou num
// script servido ao navegador se tivesse escapado.
const MARCADORES_DE_SEGREDO: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9-]{8}/, "chave da Anthropic"],
  [/postgres(?:ql)?:\/\/[^\s"']+/, "connection string do Postgres"],
  [/service_role/, "chave service role do Supabase"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada"],
];

function semSegredo(conteudo: string, origem: string): void {
  for (const [padrao, rotulo] of MARCADORES_DE_SEGREDO) {
    expect(padrao.test(conteudo), `${origem} expõe ${rotulo}`).toBe(false);
  }
}

test.describe("fronteira pública", () => {
  test("o planner responde sem sessão e proíbe cache", async ({ page }) => {
    const resposta = await page.goto("/planner");

    expect(resposta?.status()).toBe(200);
    // `no-store` é o que impede o atendimento de um cliente ficar no cache de um
    // proxy no caminho e reaparecer para o próximo.
    expect(resposta?.headers()["cache-control"]).toContain("no-store");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pré-planejamento comercial");
  });

  test("a tela de login responde sem sessão e não oferece cadastro", async ({ page }) => {
    const resposta = await page.goto("/login");

    expect(resposta?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acesse sua área");

    // Conta de acesso é criada pela equipe, nunca pela pessoa que chega ao login.
    // A busca é por controle — link ou botão —, e não por texto: a tela diz
    // "e-mail completo cadastrado" numa dica de campo, o que é outra coisa.
    const abrirConta = /cadastr|criar conta|nova conta|registr|sign\s?up/i;
    await expect(page.getByRole("link", { name: abrirConta })).toHaveCount(0);
    await expect(page.getByRole("button", { name: abrirConta })).toHaveCount(0);
    await expect(page.locator("form input")).toHaveCount(2);
  });

  for (const caminho of PAGINAS_INTERNAS) {
    test(`anônimo em ${caminho} cai no login`, async ({ page }) => {
      await page.goto(caminho);

      await expect(page).toHaveURL(/\/login(\?|$)/);
      // O destino volta na query para que o login devolva a pessoa ao lugar certo.
      expect(new URL(page.url()).searchParams.get("next")).toBe(caminho);
    });
  }

  for (const caminho of APIS_INTERNAS) {
    test(`anônimo em ${caminho} recebe 401`, async ({ request }) => {
      const resposta = await request.get(caminho);

      expect(resposta.status()).toBe(401);
      // A recusa não pode contar nada sobre o que existe do outro lado.
      const corpo = await resposta.text();
      expect(corpo).not.toMatch(/prisma|stack|at \w+ \(/i);
      semSegredo(corpo, caminho);
    });
  }

  test("escrita anônima é recusada antes de chegar ao banco", async ({ request }) => {
    for (const caminho of ["/api/pastas", "/api/extrair/confirmar", "/api/templates"]) {
      const resposta = await request.post(caminho, { data: {} });
      expect(resposta.status(), caminho).toBe(401);
    }
  });

  test("a saúde não revela segredo nem topologia", async ({ request }) => {
    const resposta = await request.get("/api/health");
    const bruto = await resposta.text();

    semSegredo(bruto, "/api/health");
    const corpo = JSON.parse(bruto);
    // A resposta é um resumo de prontidão, não um despejo de configuração: só
    // estas chaves, e nenhum valor de variável de ambiente entre elas.
    expect(Object.keys(corpo).sort()).toEqual([
      "databaseOk",
      "ok",
      "pastaCount",
      "readiness",
      "storageDriver",
    ]);
    for (const verificacao of corpo.readiness as Array<Record<string, unknown>>) {
      expect(Object.keys(verificacao).sort()).toEqual(["message", "name", "ok"]);
    }
  });
});

test.describe("o planner recusa entrada inválida sem gastar análise", () => {
  // Todas as recusas abaixo acontecem antes da análise: nenhuma consome chamada
  // paga, e por isso podem rodar em qualquer ambiente, inclusive em produção.
  test("corpo que não é JSON", async ({ request }) => {
    const resposta = await request.post("/api/planejamento-comercial/analisar", {
      headers: { "content-type": "text/plain" },
      data: "cliente=x",
    });

    expect(resposta.status()).toBe(400);
  });

  test("procedimentos acima do teto", async ({ request }) => {
    const resposta = await request.post("/api/planejamento-comercial/analisar", {
      data: { cliente: "QA", procedimentos: "a".repeat(9000), formato: "digital" },
    });

    expect(resposta.status()).toBe(422);
  });

  test("formato de entrega inexistente", async ({ request }) => {
    const resposta = await request.post("/api/planejamento-comercial/analisar", {
      data: { cliente: "QA", procedimentos: "limpeza de pele", formato: "carta-registrada" },
    });

    expect(resposta.status()).toBe(422);
  });

  test("token de plano forjado não vira PDF", async ({ request }) => {
    const resposta = await request.post("/api/planejamento-comercial/pdf", {
      data: { token: "forjado.forjado.forjado", formato: "digital", retirados: [] },
    });

    expect(resposta.ok()).toBe(false);
    expect(resposta.headers()["content-type"]).not.toContain("application/pdf");
  });
});

test.describe("o que o navegador recebe", () => {
  test("nenhum script servido ao navegador carrega segredo", async ({ page, request }) => {
    await page.goto("/planner");

    const fontes = await page.locator("script[src]").evaluateAll((elementos) =>
      elementos.map((elemento) => (elemento as HTMLScriptElement).src)
    );
    expect(fontes.length, "a página não serviu nenhum script").toBeGreaterThan(0);

    for (const fonte of fontes) {
      if (!fonte.startsWith(BASE_URL)) continue;
      const resposta = await (request as APIRequestContext).get(fonte);
      semSegredo(await resposta.text(), fonte);
    }

    semSegredo(await page.content(), "HTML do planner");
  });
});
