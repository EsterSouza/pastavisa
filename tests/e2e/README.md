# Suíte E2E — homologação do PastaVISA (PV-012)

Roda com Playwright/Chromium. O runner é separado do Vitest: `tests/e2e/**` está
excluído do `vitest.config.ts`, e as specs daqui não entram em `npm run test:run`.

```bash
npm run test:e2e
```

Sem nenhuma variável de ambiente, o Playwright sobe o `next dev` em
`http://127.0.0.1:3100` e roda o que não depende de conta nem de chave paga. O
resto se anuncia como pulado, com a variável que falta escrita no motivo — a
suíte nunca passa em falso por falta de configuração.

## O que cada arquivo cobre

| Arquivo | Cobre | Precisa de |
|---|---|---|
| `public-boundary.spec.ts` | Anônimo no planner, no login, nas páginas e nas APIs internas; forma da `/api/health`; recusas do planner; scripts servidos ao navegador | nada |
| `planner-flow.spec.ts` | Rascunho no navegador (sem conta) e o caminho completo até o PDF (com análise real) | `PV_E2E_LIVE_ANALYSIS=1` para o caminho completo |
| `authenticated-flow.spec.ts` | Papéis operador/admin e o ciclo pasta → correção → prévia → download → restauração → limpeza | contas QA |

## Variáveis

Nenhuma delas vive no repositório. Todas são opcionais.

| Variável | Para quê |
|---|---|
| `PV_E2E_BASE_URL` | Aponta a rodada para um ambiente publicado. Sem ela, o Playwright sobe o servidor local. |
| `PV_E2E_OPERADOR_EMAIL` / `PV_E2E_OPERADOR_PASSWORD` | Conta QA com papel `operador`. |
| `PV_E2E_ADMIN_EMAIL` / `PV_E2E_ADMIN_PASSWORD` | Conta QA com papel `admin`. |
| `PV_E2E_LIVE_ANALYSIS=1` | Libera a análise real do planner. |

O `PLANNER_SIGNING_SECRET` do servidor local é sorteado a cada execução e nunca
gravado em disco. Se a máquina já tiver um valor no `.env.local`, ele é
respeitado — a configuração real sempre vence sobre o valor de teste.

## Rodar contra produção

```bash
PV_E2E_BASE_URL=https://pastavisa.vercel.app npm run test:e2e
```

Duas coisas a saber antes:

- **A análise custa dinheiro e esbarra no firewall.** `PV_E2E_LIVE_ANALYSIS=1`
  dispara uma chamada paga, e a regra de produção limita o planner a 10
  requisições por IP a cada 5 minutos (`scripts/planner-firewall-rules.json`),
  contadas em conjunto para `analisar` e `pdf`. `public-boundary.spec.ts` gasta 4
  dessas 10 e o caminho completo gasta mais 2, então duas rodadas seguidas dentro
  da mesma janela derrubam a própria suíte no 429 — medido em 19/08/2026.
- **O ciclo de vida escreve no banco de produção.** Ele cria uma pasta marcada
  com o prefixo `QA-E2E` e a apaga ao final, inclusive se um passo do meio
  falhar. Ainda assim, o lugar certo para rodá-lo é um ambiente de QA.

## Contas QA

As contas são criadas e rotacionadas **por uma pessoa**, no painel do Supabase, e
a senha entra na suíte por variável de ambiente na sessão do terminal — nunca em
arquivo, commit, log ou captura de tela (regra 6 do handoff). O papel vai em
`app_metadata.role`, com valor `admin` ou `operador`; sem papel válido o login
responde 403 mesmo com senha certa.

## Limpeza

`npm run test:e2e` deixa `playwright-report/` e `test-results/` na raiz, ambos
ignorados pelo git. Apague os dois ao encerrar o card (regra 10).
