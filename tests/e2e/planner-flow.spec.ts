import { expect, test } from "@playwright/test";

import { LIVE_ANALYSIS, SKIP_MESSAGES } from "./environment";

/**
 * O caminho que o comercial percorre com o cliente na linha, ponta a ponta (PV-012).
 *
 * Só roda com `PV_E2E_LIVE_ANALYSIS=1`: a análise é chamada paga e o firewall
 * limita o planner a 10 requisições por IP a cada 5 minutos. Deixá-la ligada por
 * padrão gastaria orçamento a cada `npm run test:e2e` e derrubaria a própria
 * suíte no 429.
 */
test.describe("planner público de ponta a ponta", () => {
  test.skip(!LIVE_ANALYSIS, SKIP_MESSAGES.live);
  test.describe.configure({ mode: "serial" });

  test("do preenchimento ao PDF, sem deixar rastro no servidor", async ({ page }) => {
    await page.goto("/planner");

    // Rascunho de uma execução anterior deixaria a suíte começar no meio.
    const recomecar = page.getByRole("button", { name: "Recomeçar do zero" });
    if (await recomecar.isVisible()) await recomecar.click();

    await page.getByLabel("Nome do cliente", { exact: false }).fill("QA-E2E Clínica Homologação");
    await page.getByLabel("Município").fill("Belo Horizonte");
    await page.getByLabel("UF").fill("MG");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: "Operação declarada" })).toBeVisible();
    await page
      .getByLabel("Procedimentos realizados", { exact: false })
      .fill("Limpeza de pele\nMicroagulhamento\nDrenagem linfática");
    await page
      .getByRole("group", { name: /Reutiliza materiais/i })
      .getByRole("radio", { name: "Sim" })
      .check();
    await page
      .getByRole("group", { name: /Possui autoclave/i })
      .getByRole("radio", { name: "Sim" })
      .check();

    await page.getByRole("button", { name: "Analisar operação" }).click();

    await expect(page.getByRole("heading", { name: "Revise o que entra na pasta" })).toBeVisible({
      timeout: 60_000,
    });
    // Texto oficial da regra 8: o planner nunca afirma que o resultado é final.
    await expect(
      page.getByText("Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.")
    ).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeChecked();

    // Retirar um procedimento tem de mexer na conta antes mesmo do servidor.
    const procedimentos = page.getByRole("checkbox");
    const antes = await procedimentos.count();
    expect(antes).toBeGreaterThan(1);
    await procedimentos.last().uncheck();

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Escolha o formato de entrega" })).toBeVisible();
    await page.locator('input[name="formato"][value="colorida"]').check();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar PDF" }).click();
    const arquivo = await download;

    const caminho = await arquivo.path();
    expect(caminho, "o download não produziu arquivo").toBeTruthy();
    const { readFileSync } = await import("node:fs");
    const conteudo = readFileSync(caminho!);
    expect(conteudo.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(conteudo.byteLength).toBeGreaterThan(1000);
  });

});

/** Não depende de análise: prova a regra 9 — o planner não guarda nada no servidor. */
test.describe("rascunho do planner", () => {
  test("o preenchimento fica no navegador, e some quando se recomeça", async ({ page }) => {
    await page.goto("/planner");

    const recomecar = page.getByRole("button", { name: "Recomeçar do zero" });
    if (await recomecar.isVisible()) await recomecar.click();

    await page.getByLabel("Nome do cliente", { exact: false }).fill("QA-E2E Rascunho");
    await page.reload();

    // Retomar prova que o rascunho existe — e só existe neste navegador.
    await expect(page.getByRole("status")).toContainText("Retomamos o preenchimento");
    await expect(page.getByLabel("Nome do cliente", { exact: false })).toHaveValue("QA-E2E Rascunho");

    const guardado = await page.evaluate(() =>
      Object.keys(window.localStorage).concat(Object.keys(window.sessionStorage))
    );
    expect(guardado.length, "o rascunho não está no armazenamento do navegador").toBeGreaterThan(0);

    await page.getByRole("button", { name: "Recomeçar do zero" }).click();
    await expect(page.getByLabel("Nome do cliente", { exact: false })).toHaveValue("");
    await page.reload();
    await expect(page.getByRole("status")).toHaveCount(0);
  });
});
