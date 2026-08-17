# Handoff único — PASTAVISA

**Última atualização:** 17/08/2026 (BRT), após auditoria completa de retomada
**Repositório:** `EsterSouza/pastavisa`
**Checkout oficial:** `C:\Saas\PASTAVISA`
**Branch:** `main`

Este é o único handoff operacional do PASTAVISA. Substitui o antigo `PASTAVISA_CONTEXT.md`; o
histórico anterior permanece recuperável pelo git.

---

## 1. Como usar este documento

Cada card é autossuficiente quando lido com as seções 2 e 3. Use uma task nova por card e não
refaça pesquisas que já estejam registradas, salvo quando um fato temporal precisar ser confirmado.

### Regras globais

1. Execute **um card por task**. Trabalho descoberto de outro card é registrado, não executado.
2. Antes de editar: `git fetch origin`, confirmar `main` e `git pull --ff-only origin main`.
3. Preserve tudo fora do card. Nunca use `git add -A`; faça staging somente da lista exata do card.
4. Todo card termina na `main`, sem PR:
   - implementar e testar;
   - commit de implementação e `git push origin main`;
   - executar e verificar as ações remotas previstas no card;
   - acrescentar `### Resultado — <data>` no card, com testes, evidência, ação remota, SHA e fora de escopo;
   - commit `docs: record <CARD> result [skip ci]` e novo push;
   - confirmar `origin/main`, worktree e deployment quando aplicável.
5. Push, deploy, migrations, usuários QA e firewall descritos no card estão autorizados como parte
   dele. Não ampliar a ação remota além do texto do card.
6. Nunca registrar `.env`, tokens, senhas, service role, URLs assinadas, credenciais, dados de
   clientes ou configuração sensível em commit, handoff, log ou screenshot.
7. O planner comercial é público e sem login. Contas Supabase são somente internas/QA.
8. A interface pública não usa `IA`, `inteligência artificial`, `template`, `prompt` ou `modelo de
   linguagem`, nem afirma que cálculo automatizado foi feito manualmente. Texto oficial:
   **“Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.”**
9. O planner não persiste texto, planejamento, PDF, lead ou dados pessoais.
10. Ao encerrar cada card, remova somente artefatos temporários sem valor de continuidade:
    screenshots e imagens de QA, PDFs/DOCXs de teste, `test-results`, `playwright-report`, coverage,
    logs, `.next` e caches do card. Registre o que foi removido. Não apagar arquivos rastreados,
    ativos oficiais, manual de marca, dados reais, backups ou `node_modules` enquanto ainda for útil.
    Resolva e confira o caminho absoluto antes de limpeza recursiva.

### Modelos

| Modelo | Uso recomendado |
|---|---|
| `gpt-5.6-sol` alto/xhigh | RLS, Auth/RBAC, migrations, OOXML/DOCX, segurança, regras sanitárias e homologação. |
| `gpt-5.6-terra` médio/alto | Handoff, testes, UI especificada, refatoração visual e componentes. |

A Ester troca o modelo no seletor; o agente nunca afirma ter feito essa troca.

---

## 2. Estado verificado em 17/08/2026

Esta seção substitui a auditoria de 08/08/2026, que ficou desatualizada. Todos os números abaixo
foram medidos nesta data, contra o checkout, o Supabase de produção e a Vercel.

### 2.1 Checkout, Git e produção

- Checkout fora do OneDrive em `C:\Saas\PASTAVISA`; worktree **limpo**.
- `HEAD = main = origin/main = c702ec34e254e71f93bbe6248f36f153a6cbb938` (10/08/2026).
- Remoto: `https://github.com/EsterSouza/pastavisa.git` (repositório **público**).
- Vercel: projeto `pasta-visa` (`prj_3hksb7xOH6gQbc2lnOsKpFOsHYUa`, team `estersouzas-projects`).
  O deployment de produção mais recente é do commit `c702ec3` e está `READY`. **Repositório, `origin`
  e produção estão no mesmo SHA** — não há trabalho publicado fora do git nem commit não deployado.
- `TreinaVISA - Manual de Marca 2.0.pdf` continua na raiz, local e ignorado por `/*.pdf`.
- O projeto declara Node `22.x`; a máquina usa Node `v25.8.0`. Continue usando o build como evidência.

### 2.2 Código e qualidade

| Item | Estado em 17/08/2026 |
|---|---:|
| Páginas `page.tsx` | 9 (`(internal)` 8, `(public)` 1) |
| Rotas API `route.ts` | 37 |
| Modelos em `prisma/schema.prisma` | 8 |
| Migrations Prisma | 13 |
| Migrations Supabase versionadas | 7 |
| Stack | Next.js 14.2.35, React 18, Tailwind 3.4.1, Prisma 7.8 |
| Testes | Vitest, **16 arquivos / 61 testes, todos aprovados** |
| `npx tsc --noEmit` | aprovado, sem erros |
| `npm run lint` | aprovado, 0 erros e 0 avisos |

Todas as 37 rotas declaram `runtime = "nodejs"` e `dynamic = "force-dynamic"`. Não há `TODO`,
`FIXME` ou `HACK` no código de aplicação.

**Baseline de dependências (regressão desde 08/08):** `npm audit` informa **19 vulnerabilidades —
5 moderadas, 13 altas e 1 crítica**. Detalhamento acionável:

- **Crítica — `xmldom@0.1.31`, sem correção disponível.** Entra exclusivamente por
  `docxtemplater-image-module-free@1.1.1`, que está declarado em `package.json` mas **não é
  importado em nenhum arquivo do projeto**. Remover a dependência elimina a única crítica sem risco
  funcional. Ver PV-013.
- **Altas com correção por major:** `next` (→16, mais de 20 CVEs incluindo SSRF, cache poisoning e
  XSS no App Router), `eslint-config-next` (→16), `sharp` (→0.35.3, CVEs do libvips).
- **Altas com correção compatível:** `brace-expansion`, `fast-uri`, `js-yaml`, `deepmerge-ts`,
  `@prisma/config`, `prisma`, `hono`, `postcss`.

Scripts: `dev`, `build`, `start`, `check:deploy`, `backup:local`, `migrate:local-to-supabase`,
`migrate:storage-to-supabase`, `repair:docx`, `lint`, `sync:templates`, `test`, `test:run`,
`test:watch`.

### 2.3 Supabase de produção

Projeto: `pastavisa`, ref `imywcumdngkzkeszvyxv`, região `sa-east-1`, Postgres 17, `ACTIVE_HEALTHY`.

| Objeto | 08/08/2026 | 17/08/2026 |
|---|---:|---:|
| `Template` | 295 | **297** |
| `Pasta` | 6 | 6 |
| `Legislacao` | — | 82 |
| `DocumentoGerado` | — | 405 |
| `DocumentoUpload` | — | 148 |
| `storage.objects` | 1.236 | **1.410** |
| `auth.users` | 0 | **2** (1 `admin`, 1 `operador`, zero sem papel) |

**PV-002 e PV-003 estão comprovados em produção**, o que a seção 4 antiga ainda registrava como
pendente:

- `information_schema.role_table_grants` para `anon` e `authenticated` no schema `public` retorna
  **zero linhas** — nenhuma tabela é alcançável pelo navegador.
- Todas as tabelas de negócio, além de `hotmart_vendas` e `manychat_leads`, estão com **RLS ativa e
  zero policies** (negação total; apenas a service role passa). O Advisor classifica isso como
  `INFO`, não como risco — é o desenho pretendido.
- Existem exatamente 2 contas, ambas com papel válido em `app_metadata.role`.

**Único achado de segurança aberto no Supabase:** o Advisor reporta `WARN
auth_leaked_password_protection` — a verificação contra HaveIBeenPwned está desligada. Ver PV-014.

### 2.4 Auth e fronteira pública

- `lib/session-auth.ts` foi removido; Basic Auth não existe mais.
- `middleware.ts` usa `updateSession` (Supabase SSR) + RBAC. O matcher exclui apenas
  `_next/static`, `_next/image`, `brand/` e `favicon.ico`.
- `isPublicPath` libera: `/login`, `/api/auth/*`, `/api/health`, `/planner*`,
  `/api/planejamento-comercial/analisar` e `/api/planejamento-comercial/pdf`.
- `isAdminOnlyPath` cobre `/templates`, `/legislacoes`, `/api/templates`, `/api/legislacoes`.
- `requireAdmin()` protege o `DELETE` no handler em 5 rotas; `check:deploy` audita que **toda** rota
  com `DELETE` tenha essa proteção.
- **Rotas públicas declaradas mas inexistentes:** `/planner` e `/api/planejamento-comercial/pdf`
  estão liberadas no middleware e na regra WAF, mas os arquivos não existem — hoje retornam 404.
  Pertencem ao PV-009 e não são vazamento.

### 2.5 O que existe e o que não existe

Verificado por inspeção de arquivos, para não refazer pesquisa:

| Entrega | Arquivos | Estado |
|---|---|---|
| Motor sanitário do planner | `lib/commercial-planner/*` (12 módulos) | Existe |
| API pública de análise | `app/api/planejamento-comercial/analisar/route.ts` | Existe |
| Supabase Auth | `lib/supabase/{browser,server,middleware}.ts`, `lib/auth/authorization.ts` | Existe |
| Design system | `docs/DESIGN.md`, `components/{brand,shell,theme,ui}` | Existe |
| Preflight DOCX | `lib/docx-replacement-plan.ts`, rota `preflight` | Existe (PV-004, 17/08) |
| Fluxo visual de correção | `components/correction/`, rota `restaurar` | **Ausente** (PV-005) |
| Planner público e PDF | `app/(public)/planner/page.tsx`, rota `pdf`, `render-pdf.ts`, `pdf-lib` | **Ausente** (PV-009) |
| E2E | `tests/e2e/`, `playwright.config.ts`, `scripts/check-public-boundary.mjs` | **Ausente** (PV-012) |

### 2.6 Correção de documentos prontos — risco técnico atual

- UI: `app/(internal)/pasta/[id]/corrigir-lote/page.tsx` (698 linhas).
- Aplicação: `app/api/pastas/[id]/uploads-corrigidos/aplicar/route.ts` e
  `lib/header-footer-replace.ts` (476 linhas).
- A rota processa **um documento por chamada** (o cliente faz o laço), com `maxDuration = 60`.
- **Resolvido pelo PV-004 em 17/08:** existe preflight, existe trava de hash 409, e o motor
  preserva a estrutura do Word em vez de concentrar o parágrafo no primeiro run.
- **Continua em aberto — restauração.** A base de cada correção é `doc.outputPath || doc.uploadPath`,
  ou seja, correções são **cumulativas sobre a saída anterior**, não sobre o original. Um par aplicado
  por engano ainda não tem como ser desfeito; o passo de restaurar é entrega do PV-005. O preflight
  ao menos avisa: devolve `baseCorrigida: true` quando a base já é uma correção.
- **Continua em aberto — trava de hash inativa.** `hashOrigem` é opcional na rota aplicar até o
  PV-005 ligar analisar → aplicar. Enquanto isso a proteção existe mas não é exercida pela UI.
- **Continua em aberto — logo.** A substituição de texto usa as partes *ativas* resolvidas por
  `sectPr`, mas `replaceLogoInHeadersAndFooters` ainda itera todas as partes presentes no zip, órfãs
  incluídas, trocando a imagem de menor `rId` de cada uma. Em documento com imagem que não é logo, a
  imagem errada pode ser substituída. Ficou **fora** do PV-004 por exigir verificação visual; tratar
  junto do PV-005, que já prevê QA com DOCX real.
- Em erro, a rota responde **HTTP 200** com `status: "erro"` no corpo. É intencional para o laço do
  cliente; qualquer monitoramento externo precisa saber disso.

### 2.7 Modelos de IA em uso

`lib/ai.ts` chama a API Anthropic em 5 pontos, sem `temperature`, `top_p` ou `thinking`:

| Linha | Modelo | Uso |
|---|---|---|
| 46 | `claude-sonnet-4-5-20250929` | Motor sanitário do planner (`runCommercialPlannerAnalysis`) |
| 173 | `claude-haiku-4-5-20251001` | `extractClienteData` |
| 339 | `claude-haiku-4-5-20251001` | `extractClienteDataFromElaboracaoText` |
| 400, 955 | `claude-haiku-4-5-20251001` (padrão) | `adaptTrecho`, `processAdaptBlock` |

`claude-haiku-4-5` continua sendo modelo **atual** — não há nada a fazer nesses quatro pontos.
`claude-sonnet-4-5` é legado, ainda ativo e sem data de aposentadoria anunciada. Ver PV-016.

### 2.8 Artefatos locais fora do git

Não rastreados e sem valor de continuidade: `.pv008-dev.log`, `.pv008-dev.err.log`,
`tsconfig.tsbuildinfo`, `.next/` e o diretório vazio `entregas/templates-subcisao` (criado em
16/08/2026, sem conteúdo e sem card correspondente). Ver PV-017.

---

## 3. Contexto técnico e decisões consolidadas

### 3.1 Fluxo existente

1. `/pasta/nova` recebe PDF do forms.app e DOCX “Documentos em Elaboração”.
2. `/api/extrair` salva, extrai o DOCX, envia o PDF em base64 e aplica fallbacks determinísticos.
3. `/api/extrair/confirmar` cria `Pasta` e `DocumentoGerado[]` e associa templates ativos.
4. `/pasta/[id]/editar` revisa cadastro, responsáveis, operação, resíduos e logo.
5. `/pasta/[id]/processar` seleciona templates, legislações e equipamentos e chama `/api/gerar`.
6. `lib/generator.ts` substitui variáveis, processa blocos especiais, logo, referências e versões.

Preservar: PDF como documento base64; fallback determinístico da lista; referências Storage
`supabase://bucket/path`; mensagens de erro que nomeiam arquivo, logo, transformação, upload ou banco.

### 3.2 Dados

- `Pasta`: cliente, responsáveis, estrutura, serviços, equipe, equipamentos, insumos, resíduos,
  arquivos e logo.
- `DocumentoGerado`/`DocumentoVersao`: geração final e histórico.
- `DocumentoUpload`/`DocumentoUploadVersao`: documentos prontos corrigidos.
- `Template`/`TemplateVersao`: catálogo interno e histórico.
- `Legislacao`: referências federal, estadual e municipal.

Schemas SQLite/Postgres: `prisma/schema.prisma` e `prisma/schema.supabase.prisma`. Mudança de modelo
deve manter os dois e migrations quando o card exigir.

### 3.3 Regras sanitárias do planner

- Um cliente por análise; nunca transportar dados entre pedidos.
- Usar somente procedimentos explícitos.
- Produto, marca, ativo, indicação, equipamento ou etapa não é procedimento automaticamente.
- Selecionar o conjunto mínimo operacional de POPs, TCLEs, fichas e registros.
- Mapa interno por técnica: cobertura exata, base personalizável, família equivalente ou novo documento.
- TCLE amplo só absorve específico sem diferença material de risco/consentimento.
- Esterilização só entra com reutilização, processamento e autoclave confirmados.
- Catálogo, IDs, scores, prompts e classificação de cobertura nunca chegam ao navegador.

### 3.4 Planner e preço

`POST /api/planejamento-comercial/analisar` receberá cliente, município/UF, procedimentos,
reutilização, autoclave, equipamentos opcionais e formato. Retornará token assinado de duas horas,
procedimentos, documentos públicos, alertas e resumo. `POST /api/planejamento-comercial/pdf` validará
o token e recalculará no servidor.

- Digital: R$ 597.
- Preto e branco + digital: R$ 797.
- Colorida + digital: R$ 957.
- Adicional: `ceil(max(total - 100, 0) / 50) * R$ 100`.
- 101–150 = +R$100; 151–200 = +R$200; 201–250 = +R$300.
- Prazo base: 15 dias úteis; acima de 100, sujeito à confirmação técnica.

O comercial pode retirar procedimentos para chegar a 100. O planner não cria pasta, lead, histórico,
pagamento ou envio automático.

---

## 4. Mapa dos cards

Estado revisado contra o código e a produção em 17/08/2026. **PV-002 e PV-003 constavam como
pendentes e estão concluídos e comprovados** (ver 2.3).

| Card | Entrega | Modelo | Esforço | Prioridade | Depende de | Estado |
|---|---|---|---|---|---|---|
| PV-000 | Checkout e handoff único | gpt-5.6-terra | médio | P0 | — | Concluído |
| PV-001 | Fundação de testes | gpt-5.6-terra | médio | P0 | PV-000 | Concluído |
| PV-002 | Fechamento de tabelas expostas | gpt-5.6-sol | alto | P0 segurança | PV-000 | **Concluído** (`1a03f6f`); zero grants confirmado em produção |
| PV-003 | Supabase Auth, papéis e QA | gpt-5.6-sol | alto | P0 segurança | PV-001, PV-002 | **Concluído** (`b7d1272`); 2 contas com papel em produção |
| PV-004 | Motor seguro de substituição | gpt-5.6-sol | xhigh | P1 principal | PV-001, PV-003 | **Concluído** (`9ed5856`); preflight, trava de hash 409 e preservação estrutural |
| PV-005 | Fluxo visual de correção | gpt-5.6-terra | alto | P1 principal | PV-004 | Pendente — **liberado**; deve consumir preflight e enviar `hashOrigem` |
| PV-006 | Motor sanitário do planner | gpt-5.6-sol | xhigh | P1 sanitário | PV-001 | Concluído |
| PV-007 | API pública, preços e proteção | gpt-5.6-sol | alto | P1 segurança | PV-003, PV-006 | Concluído; segredo, WAF Hobby e 429 comprovados |
| PV-008 | Manual de marca e design system | gpt-5.6-terra | alto | P1 visual | Manual | Publicado; **zoom 200% e teclado seguem sem evidência** (ver PV-018) |
| PV-009 | Planner público e PDF | gpt-5.6-sol | alto | P1 comercial | PV-007, PV-008 | Pendente — **maior lacuna de negócio** |
| PV-010 | Redesign interno principal | gpt-5.6-terra | alto | P2 visual | PV-005, PV-008 | Pendente |
| PV-011 | Redesign templates/legislações | gpt-5.6-terra | alto | P2 manutenção | PV-003, PV-008 | Pendente |
| PV-012 | E2E e homologação final | gpt-5.6-sol | alto | P1 lançamento | PV-009, PV-010, PV-011 | Pendente |

Cards abertos pela auditoria de 17/08/2026:

| Card | Entrega | Modelo | Esforço | Prioridade | Depende de | Estado |
|---|---|---|---|---|---|---|
| PV-013 | Remover rota de teste e dependência crítica | gpt-5.6-terra | baixo | **P0 higiene** | — | Pendente |
| PV-014 | Endurecer senha e reduzir vulnerabilidades | gpt-5.6-sol | médio | P1 segurança | PV-013 | Pendente |
| PV-015 | Restringir superfície de `/api/health` | gpt-5.6-terra | baixo | P2 segurança | — | Pendente |
| PV-016 | Atualizar modelo do motor sanitário | gpt-5.6-sol | médio | P2 | PV-006 | Pendente |
| PV-017 | Limpeza de artefatos locais | gpt-5.6-terra | baixo | P3 | — | Pendente |
| PV-018 | Fechar aceite de acessibilidade do PV-008 | gpt-5.6-terra | baixo | P1 visual | PV-008 | Pendente |

### Ordem recomendada de execução

1. **PV-013** — baixo esforço, elimina a única vulnerabilidade crítica e uma rota que escreve lixo em
   produção. Nada depende dele; faça primeiro.
2. **PV-018** e **PV-015** — pequenos, fecham dívidas abertas sem tocar em fluxo.
3. ~~PV-004~~ → **PV-005** — o PV-004 já entregou o motor seguro e a análise prévia; falta a UI
   consumir o preflight, enviar `hashOrigem` e oferecer restauração. A correção continua cumulativa
   sobre a saída anterior até o PV-005 entregar o passo de restaurar.
4. **PV-009** — a maior lacuna de negócio: o planner comercial existe do lado do servidor e está
   pago em WAF e segredo, mas não tem página pública nem PDF.
5. **PV-014** e **PV-016** — mexem em dependências e modelo; exigem build e suíte verdes antes.
6. **PV-010 → PV-011 → PV-012** — visual e homologação final.

---

## 5. Cards executáveis

## PV-000 — Checkout e handoff único

**Modelo:** gpt-5.6-terra · **Esforço:** médio · **Prioridade:** P0
**Resultado:** checkout íntegro e um único documento de continuidade.

### Arquivos

- Criar `docs/HANDOFF.md`.
- Modificar `README.md` e `LEIAME.md`.
- Remover `PASTAVISA_CONTEXT.md` após atualizar referências.

### Implementação

- Preparar `C:\Saas\PASTAVISA` sem mover/versionar arquivos locais ignorados.
- Confirmar Git, runtime, scripts, Supabase e limite de acesso Vercel.
- Consolidar arquitetura, estado, decisões, contratos, mapa e cards.
- Fazer README/LEIAME apontarem para este handoff; provar que não resta referência obsoleta.

### Testes

- `npm.cmd ci`
- `npm.cmd run build`
- `npm.cmd run check:deploy`
- `git fsck --full`
- `rg "PASTAVISA_CONTEXT" .`

### Critérios de aceite

- [x] Checkout fora do OneDrive e sincronizado.
- [x] Único handoff operacional, sem segredo.
- [x] Build preservado.
- [x] Manual local preservado e não rastreado.
- [x] Temporários do card removidos.

### Fora de escopo

- Código funcional, banco, Auth, frontend, migrations ou uso do manual.

### Commit

`docs: add canonical PastaVISA handoff`

### Resultado — 08/08/2026

**Concluído.** O checkout oficial foi preparado em `C:\Saas\PASTAVISA`, fora do OneDrive, com
`main` sincronizada. O manual de marca que já estava na raiz permaneceu local, ignorado e intocado.

#### Alterações entregues

- Criado o handoff único com estado verificado, contexto mínimo, decisões, mapa e cards executáveis.
- `README.md` e `LEIAME.md` passaram a apontar para este documento.
- `PASTAVISA_CONTEXT.md` foi removido depois da consolidação; as menções remanescentes ao nome são
  somente históricas ou pertencem ao próprio critério de auditoria do PV-000.
- Commit de implementação: `146b73ceda54b720ef7e326235e96a10e5fd7329`.

#### Evidência de validação

- `npm.cmd ci`: passou; Prisma Client 7.8 gerado; 607 pacotes instalados.
- `npm.cmd run build`: passou. A primeira tentativa foi bloqueada pelo sandbox ao baixar Inter; a
  repetição autorizada com rede compilou, tipou e gerou 9 páginas sem erro.
- `npm.cmd run check:deploy`: passou integralmente.
- `git fsck --full`: passou sem saída de erro.
- `git diff --cached --check`: passou depois da remoção de espaços finais.
- Busca de padrões de segredo nos arquivos do card: nenhum valor encontrado.
- `origin/main`: confirmado no commit de implementação antes deste registro.
- Check Vercel do commit de implementação: `success`. Não houve smoke funcional autenticado, pois
  contas Supabase Auth pertencem ao PV-003.

#### Produção e dados

- Nenhuma migration, seed, usuário, dado, objeto Storage, env ou regra Vercel foi alterado.
- O único efeito remoto foi o push documental na `main` e seu deployment automático.

#### Limpeza

- Removidos `C:\Saas\PASTAVISA\.next` e `C:\Saas\PASTAVISA\prisma\dev.db`, ambos gerados pelo build.
- Mantidos `node_modules` e o Prisma Client gerado porque serão reutilizados pelo PV-001.
- Nenhuma imagem, PDF ou ativo oficial foi removido.

#### Deliberadamente fora de escopo

- Vulnerabilidades de dependências apenas registradas, sem correção automática.
- RLS, Auth, contas QA, correção DOCX, planner, manual de marca e frontend permanecem nos cards próprios.

**Próximo card liberado:** PV-001 — Fundação de testes, com `gpt-5.6-terra` em esforço médio.

---

## PV-001 — Fundação de testes

**Modelo:** gpt-5.6-terra · **Esforço:** médio · **Prioridade:** P0 · **Depende de:** PV-000
**Resultado:** testes automatizados antes de mudanças críticas.

### Arquivos

- Modificar `package.json`, `package-lock.json`, `docs/HANDOFF.md`.
- Criar `vitest.config.ts`, `tests/setup.ts`, `tests/lib/env-readiness.test.ts`.

### Implementação

- Adicionar Vitest, jsdom, Testing Library React e jest-dom, com lockfile.
- Scripts `test`, `test:run`, `test:watch`; alias `@`; Node padrão e jsdom por teste.
- Testar readiness sem imprimir env; registrar baseline de build/lint/testes.

### Testes e aceite

- `npm.cmd run test:run`, build e lint.
- Testes com exit zero, comportamento igual e falhas preexistentes quantificadas.

### Fora de escopo

- Playwright, screenshot e produção.

### Commit

`test: establish PastaVISA test baseline`

### Resultado — 08/08/2026

**Concluído.** Vitest foi configurado como base de testes sem alterar código de produção ou
comportamento da aplicação.

Commit de implementação: `c0d072a`.

#### Alterações entregues

- Adicionados Vitest, jsdom, Testing Library React e `@testing-library/jest-dom` como dependências de desenvolvimento, com lockfile atualizado.
- Disponibilizados `npm run test`, `npm run test:run` e `npm run test:watch`.
- `vitest.config.ts` mantém ambiente Node por padrão, resolve o alias `@` e deixa jsdom como opt-in
  explícito para testes de componente com `@vitest-environment jsdom`.
- Criado `tests/setup.ts` com os matchers jest-dom e a primeira matriz de `env-readiness`: desenvolvimento local e produção completamente configurada. Os testes usam apenas marcadores locais e não imprimem nem registram valores de ambiente.

#### Baseline e validação

- Antes do runner: não havia script nem suíte automatizada de testes.
- `npm.cmd run test:run`: passou, 1 arquivo e 2 testes, exit code 0.
- `npm.cmd run build`: passou, com 9 páginas geradas.
- `npm.cmd run lint`: passou, **0 erros e 0 avisos preexistentes**.
- `npm audit`, após a instalação das dependências do card, informou 17 vulnerabilidades no grafo
  atual (6 moderadas, 10 altas e 1 crítica). Nenhum `npm audit fix` foi executado.

#### Deliberadamente fora de escopo

- Playwright, screenshots, testes de produção e qualquer alteração funcional.

---

## PV-002 — Fechamento das tabelas expostas

**Modelo:** gpt-5.6-sol · **Esforço:** alto · **Prioridade:** P0 segurança · **Depende de:** PV-000
**Resultado:** `hotmart_vendas` e `manychat_leads` fechadas para navegador.

### Arquivos

- Criar `supabase/migrations/20260808000100_lock_down_integration_tables.sql`.
- Criar `supabase/tests/20260808000100_lock_down_integration_tables.test.sql`.
- Modificar `docs/HANDOFF.md`.

### Implementação

- Revogar `anon`/`authenticated`, ativar RLS, não criar policy pública e preservar service role.
- Aplicar em `imywcumdngkzkeszvyxv`; verificar grants, RLS, policies e Advisor.

### Testes e aceite

- Assert SQL, REST pública negada e integração autorizada funcional.
- Nenhum registro público; migration, ledger e schema correspondem.

### Fora de escopo

- Modificar dados, webhooks ou apagar registros.

### Commit

`security: lock down integration tables`

---

## PV-003 — Supabase Auth, papéis e contas QA

**Modelo:** gpt-5.6-sol · **Esforço:** alto · **Prioridade:** P0 segurança · **Depende de:** PV-001, PV-002
**Resultado:** Basic Auth substituído por Supabase Auth e RBAC.

### Arquivos

- Modificar `.env.example`, package/lock, middleware, readiness, script de deploy, login e APIs Auth.
- Criar `lib/supabase/{browser,server,middleware}.ts`, `lib/auth/authorization.ts`, testes `tests/auth/`.
- Remover `lib/session-auth.ts`; atualizar `docs/HANDOFF.md`.

### Implementação

- `@supabase/ssr`; chave publicável preferida com fallback anon legada.
- Login e-mail/senha sem signup. Papel em `app_metadata.role`.
- `admin` completo; `operador` usa pastas/geração/correção, sem templates, legislações e delete.
- Autorização destrutiva também no handler.
- Criar dois usuários QA confirmados; senhas só em memória e rotacionadas.
- Configurar Vercel sem expor valores; planner permanece público.

### Testes e aceite

- 401, 403, login/logout, expiração, open redirect, smoke desktop/mobile, build/readiness.
- Zero signup, Basic Auth removido e QA ausente de código/log/screenshot.

### Fora de escopo

- Recuperação de senha e convites.

### Commit

`feat: migrate internal access to Supabase Auth`

---

## PV-004 — Motor seguro de substituição DOCX

**Modelo:** gpt-5.6-sol · **Esforço:** xhigh · **Prioridade:** P1 · **Depende de:** PV-001, PV-003
**Resultado:** preflight e preservação estrutural do Word.

### Arquivos

- Modificar `lib/header-footer-replace.ts`, `lib/docx-validator.ts` e rota aplicar.
- Criar `lib/docx-replacement-plan.ts`, rota preflight e testes lib/API.
- Atualizar `docs/HANDOFF.md`.

### Implementação

- SHA-256 do original e trava 409 por hash divergente.
- Contagem por substituição/corpo/cabeçalho/rodapé/contexto/documento.
- Exato + variação de espaços, sem regex livre.
- Mapear caracteres a `w:t`, aplicar do fim e distribuir pelos runs preservando propriedades,
  `xml:space`, imagens e relações. Remover fallback do primeiro run.
- Validar antes de salvar/criar versão; atomicidade por documento e erro por dependência.

### Testes e aceite

- Runs simples/múltiplos, formatação mista, header/footer/tabela, acentos, sobreposição, zero/múltiplas,
  corrompido, hash antigo, Storage/banco e abertura final.
- Operador vê o impacto; zero não é sucesso; parte não alterada permanece equivalente.

### Fora de escopo

- Conteúdo sanitário e editor Word livre.

### Commit

`feat: add safe DOCX replacement preflight`

### Resultado — 17/08/2026

**Concluído.** Commit de implementação: `9ed5856`.

#### Alterações entregues

- Criado `lib/docx-replacement-plan.ts`, agora **fonte única** da contagem prévia e da
  aplicação: `planejarSubstituicoes` e `aplicarSubstituicoes` percorrem o mesmo código com uma flag.
  Contagem e escrita não podem divergir por construção, e há teste fixando essa igualdade.
- O motor mapeia cada caractere visível ao `<w:t>` que o contém e aplica **do fim para o início**,
  distribuindo pelos runs. O fallback que concentrava o parágrafo inteiro no primeiro run foi
  **removido** — era ele que destruía formatação mista.
- Apenas o conteúdo textual de `<w:t>` é reescrito. Nenhum elemento é criado, movido ou removido,
  então imagens, `<w:tab/>`, quebras, bookmarks, `<w:proofErr>`, campos `<w:instrText>`, rsids,
  `<w:rPr>` e relações sobrevivem **por construção**, não por cuidado pontual.
- As ocorrências são localizadas sobre o texto original antes de qualquer escrita: um par nunca
  reprocessa o resultado de outro (`alpha→beta` seguido de `beta→gama` não encadeia). Sobreposição é
  resolvida pela ordem dos pares, e o par perdedor é reportado com zero em vez de aplicado pela metade.
- `xml:space="preserve"` é acrescentado quando o texto restante tem espaço nas bordas.
- `lib/docx-validator.ts` passou a exportar `validateXmlWellFormed`, e cada parte reescrita é
  validada **antes** de voltar ao pacote; a falha nomeia a parte responsável.
- Criada `POST /api/pastas/[id]/uploads-corrigidos/preflight`: conta o impacto sem alterar nada e
  devolve total, quebra por corpo/cabeçalho/rodapé, contexto com o trecho delimitado por «», o
  SHA-256 da base e `baseCorrigida`, que avisa quando o operador está corrigindo sobre uma correção
  anterior.
- `aplicar` agora lê a base e confere o hash **antes** de marcar o documento como `processando`, de
  modo que uma recusa não deixa o registro em estado intermediário. Hash divergente devolve **409**.
  A resposta ganhou `contagens` e `hashOrigem`, sem remover nenhum campo existente.

#### Decisões que valem para os próximos cards

- **`hashOrigem` é opcional na rota aplicar.** Torná-lo obrigatório quebraria a página de correção em
  produção hoje, já que a UI é escopo do PV-005. A trava só passa a valer de fato quando o PV-005
  ligar analisar → aplicar. **PV-005 deve passar a enviar `hashOrigem`.**
- **Sem alteração de schema.** O hash é calculado sobre o buffer no momento do uso e trafega no
  round-trip preflight → aplicar. Não há coluna nova, migration Prisma ou migration Supabase.
- **A logo não foi tocada.** A auditoria registrou que `replaceLogoInHeadersAndFooters` ainda varre
  todas as partes do zip, e não as ativas, podendo trocar a imagem errada em documento que tenha
  outra imagem. O card é sobre substituição de texto, e uma mudança na logo exige verificação visual
  que não existe aqui. Segue registrado como pendência, agora isolada no único ponto do arquivo que
  não passa pelo motor novo.

#### Limite conhecido

Quando um par atravessa uma tabulação, o texto novo entra inteiro antes dela e a tabulação sobra ao
final do trecho, o que pode desalinhar um layout `rótulo <tab> valor`. O documento continua íntegro e
o texto correto, e nada é perdido — o comportamento anterior também quebrava esse caso, removendo a
tabulação. Está documentado no código e contornável casando rótulo e valor em pares separados.

#### Evidência de validação

- `npm.cmd run test:run`: **19 arquivos e 95 testes aprovados** (eram 16 e 61). Os 34 novos cobrem
  run simples, runs múltiplos, formatação mista, cabeçalho/rodapé/tabela, acentos e entidades sem
  escape duplo, tolerância a espaço sem aceitar regex livre, sobreposição, ausência de encadeamento,
  zero e múltiplas ocorrências, contexto, preservação de desenho e relação, cabeçalho órfão, fallback
  quando o `sectPr` não resolve, igualdade plano/aplicado, pureza do plano, arquivo corrompido,
  estabilidade do hash e par vazio.
- `tests/correction/word-real-noise.test.ts` exercita XML com o ruído que o Word realmente emite —
  rsids, `<w:proofErr>` cortando a razão social ao meio, bookmark, `<w:lastRenderedPageBreak/>`,
  campo `<w:instrText>`, tabulação entre runs e tabela aninhada logo após parágrafo vazio
  auto-fechado — e passou na primeira execução.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run check:deploy`, `git diff --check` e
  `npm.cmd run build`: aprovados. As 9 páginas foram preservadas e a rota `preflight` aparece no
  mapa de rotas do build.
- **Sem smoke com DOCX real de cliente.** Não há `.docx` no checkout e as credenciais de Storage não
  estão no ambiente local. O teste de ruído do Word é o substituto automatizado; a abertura de um
  documento real no Word continua sendo item de QA do PV-005.

#### Produção e dados

Nenhuma migration, escrita em banco, objeto de Storage, variável de ambiente ou regra Vercel foi
alterada.

---

## PV-005 — Fluxo visual de correção

**Modelo:** gpt-5.6-terra · **Esforço:** alto · **Prioridade:** P1 · **Depende de:** PV-004
**Resultado:** Upload → Analisar → Revisar → Aplicar → Baixar/Restaurar.

### Arquivos

- Modificar página de corrigir lote e `DocumentPreviewModal`.
- Criar componentes em `components/correction/`, rota restaurar e testes.
- Atualizar `docs/HANDOFF.md`.

### Implementação

- Cinco etapas com validação; tabela de contagem/contexto; exclusão de documento/par.
- Confirmação de zero/múltiplos inesperados; progresso e retry seletivo.
- Restauração cria nova versão/saída sem apagar anterior; preview/download mantidos.

### Testes e aceite

- Upload inválido/misto, lote parcial, filtros, bloqueio, retry, restauração repetida, teclado/foco/live
  region e DOCX real pequeno.
- Operador sabe o que muda; erro nomeia dependência/ação; histórico recuperável.

### Fora de escopo

- Redesign das demais telas.

### Commit

`feat: improve corrected document workflow`

### Entrega antecipada autorizada — exclusão múltipla — 08/08/2026

- A seleção já existente na correção em lote passou a oferecer `Excluir selecionados (N)`, com
  confirmação, estado desabilitado durante processamento e mensagem explícita de sucesso ou falha.
- O `DELETE` aceita um ou vários IDs, remove no máximo 100 por chamada e valida que todos pertencem
  à pasta antes de apagar saídas e registros; mistura de IDs não produz exclusão parcial.
- Teste focado: 2 cenários de lote aprovados. Suíte completa, lint, TypeScript e build também passaram.
- Commit publicado na `main`: `2a31f1e` (`feat: add bulk deletion to correction workflow`).
- O restante do PV-005 continua pendente e não foi antecipado.

---

## PV-006 — Motor sanitário do planner

**Modelo:** gpt-5.6-sol · **Esforço:** xhigh · **Prioridade:** P1 sanitário · **Depende de:** PV-001
**Resultado:** texto explícito vira lista mínima e prudente.

### Arquivos

- Criar módulos `lib/commercial-planner/` para tipos, validação, extração, cobertura, plano, saída e prompts.
- Criar testes sanitários em `tests/commercial-planner/`; atualizar handoff.

### Implementação

- Reaproveitar `lib/ai.ts` e catálogo somente no servidor.
- Apenas procedimentos explícitos; produto/marca/ativo/indicação/equipamento não vira procedimento.
- Mapa de cobertura e conjunto mínimo; TCLE amplo só se equivalente; esterilização só confirmada.
- Isolamento total entre pedidos; saída pública sem mecanismo interno.

### Testes e aceite

- Produto/marca, sinônimos, duplicatas, técnicas parecidas, reutilização/autoclave, TCLE amplo,
  equipamento ausente, clientes A/B e lacunas.
- Lista mínima, cada técnica coberta, dúvida vira alerta e catálogo não sai.

### Fora de escopo

- Pasta definitiva e revisão técnica final.

### Commit

`feat: add commercial planning engine`

### Resultado — 08/08/2026

- Criados módulos separados para tipos, validação, extração explícita, mapa de cobertura, conjunto
  mínimo, saída pública e prompts, além do carregador de catálogo e orquestrador `server-only`.
- O motor reaproveita o cliente Anthropic de `lib/ai.ts`, usa somente o catálogo ativo carregado no
  servidor e não persiste pedido, análise ou resultado.
- A validação exige evidência literal, elimina produto, marca, ativo, indicação, equipamento e etapa,
  consolida somente pelo nome técnico canônico e mantém técnicas materialmente distintas.
- O mapa troca sugestões pelos nomes reais do catálogo, exige equivalência para documento que cobre
  várias técnicas e cria item provisório com alerta quando não encontra cobertura segura.
- TCLE amplo não absorve específicos sem equivalência; esterilização exige reutilização e autoclave;
  documento de gestão de equipamento exige equipamento informado.
- A saída pública contém somente procedimentos, documentos, alertas, resumo e o aviso oficial; IDs,
  catálogo, modo de cobertura, pontuação e prompts permanecem internos.
- Testes sanitários: 12 aprovados. Suíte completa: 5 arquivos e 16 testes aprovados. `next lint` sem
  avisos, `tsc --noEmit` sem erros e `next build` concluído com código 0.
- Limitação observada no build local: após concluir as páginas, um processo paralelo de inicialização
  do SQLite registrou `duplicate column name: clienteProdutosInsumos`; não houve alteração de schema
  nem migration neste card, e o build permaneceu aprovado.
- Commit publicado na `main`: `a60cc73` (`feat: add commercial planning engine`).
- Fora de escopo preservado: API pública, preço, PDF, pasta definitiva e revisão técnica final.

---

## PV-007 — API pública, preço e proteção

**Modelo:** gpt-5.6-sol · **Esforço:** alto · **Prioridade:** P1 segurança · **Depende de:** PV-003, PV-006
**Resultado:** planner anônimo sem retenção nem exposição interna.

### Arquivos

- Criar rota analisar e módulos `pricing.ts`, `signed-plan.ts`, `safe-logging.ts` com testes.
- Modificar middleware, `.env.example`, readiness, check-deploy e handoff.

### Implementação

- Liberar apenas planner e APIs; corpo 12 KB, procedimentos 8 KB.
- HMAC com `PLANNER_SIGNING_SECRET`, duas horas, `Cache-Control: no-store`.
- Sem Prisma/Storage/service role na fronteira pública; logs só request ID/duração/status/quantidades.
- Vercel Hobby: uma regra compartilhada para análise e PDF, 10 POST/5 min/IP e método estrito.
- Status 400/422/429/503 e preço em função pura.

### Testes e aceite

- 99/100/101/150/151/200/201, três formatos, token alterado/expirado, preço forjado, payload,
  imports proibidos e firewall.
- Público funciona, restante protegido, nada no banco e valor não forjável.

### Fora de escopo

- CRM, lead, e-mail e histórico.

### Commit

`feat: expose secure public planning analysis`

### Resultado de implementação — 09/08/2026

- Criada `POST /api/planejamento-comercial/analisar`, única API de análise liberada pelo middleware,
  com JSON de até 12 KB, procedimentos de até 8 KB, método estrito, `Cache-Control: no-store`,
  request ID próprio e respostas 400/422/503 sem detalhes internos.
- Preço implementado como função pura para digital, preto e branco + digital e colorida + digital.
  Os limites 99/100/101/150/151/200/201 foram cobertos e qualquer preço enviado pelo navegador é
  ignorado; o servidor recalcula base, adicional e total.
- O plano público e seu preço são assinados com HMAC SHA-256 por `PLANNER_SIGNING_SECRET`, com validade
  fixa de duas horas. Token alterado, expirado ou com preço modificado é recusado.
- A fronteira pública não importa Prisma, Storage, Supabase ou service role. O motor sanitário continua
  podendo consultar o catálogo ativo somente por sua camada interna e não executa escrita ou retenção.
- Logs da rota contêm exclusivamente request ID, duração, status e quantidades de bytes, procedimentos e
  documentos; cliente, local, texto, alerta, preço e token não são registrados.
- Readiness, `.env.example` e `check:deploy` passaram a exigir a assinatura do planner e auditar rota,
  imports proibidos, método, limites e a especificação versionada das regras WAF.
- Evidência local: `npm.cmd run test:run` passou com 14 arquivos e 54 testes; `next lint` sem avisos;
  `npx.cmd tsc --noEmit`, `npm.cmd run check:deploy` e `npm.cmd run build` passaram.
- Vercel: a regra de análise 10 POST/5 min/IP foi preparada como rascunho, sem publicação. A regra de PDF
  20 POST/5 min/IP foi recusada com `Rate limiting is not available for this plan (401)`. O diff remoto
  contém somente a regra de análise e não altera produção até publicação. Para concluir o aceite 429,
  habilitar um plano com WAF rate limiting, preparar a segunda regra, revisar ambas e publicar.
- DesignMD MCP foi configurado no projeto por `.codex/config.toml`, com credencial gratuita somente na
  variável de usuário `DESIGNMD_TOKEN`; nenhum valor foi gravado no repositório ou log. O endpoint direto
  com `www` evita perder o cabeçalho no redirecionamento. Reiniciar o Codex e validar a conexão antes do PV-009.
- O PV-003 foi isolado e versionado antes deste card no commit `b7d1272`, preservando a dependência e sem
  misturar seus arquivos com o commit de implementação do PV-007.
- Nenhuma migration, escrita em banco/Storage, lead, CRM, e-mail, histórico, deploy ou regra WAF publicada
  foi executada.

### Fechamento remoto — 10/08/2026

- `PLANNER_SIGNING_SECRET` foi criado diretamente como variável `Sensitive` no ambiente Production, com
  valor criptográfico aleatório não exibido nem gravado no repositório. O deployment do commit `e9de691`
  ficou `Ready` e recebeu a variável.
- A especificação local e a configuração remota foram consolidadas em uma única regra compatível com o
  Hobby: os caminhos exatos `/api/planejamento-comercial/analisar` e
  `/api/planejamento-comercial/pdf`, somente `POST`, 10 requisições por 300 segundos, chave `ip`, janela
  fixa e ação de excedente `rate_limit` (HTTP 429).
- A regra foi publicada primeiro com ação de excedente `log`. Na observação, 11 `POST`s ao caminho de PDF
  chegaram à aplicação e retornaram 404, sem bloqueio. Após revisão das condições, a ação 429 foi publicada;
  `GET` continuou retornando 404 e o primeiro `POST` seguinte retornou 429 porque o mesmo IP já estava acima
  do limite na janela de observação.
- Estado remoto final: regra `live`, válida, habilitada, sem rascunhos ou mudanças pendentes.
- Smoke sanitário do PV-006 no alias de produção: HTTP 200, `Cache-Control: no-store`, request ID, preço e
  token assinado presentes. A resposta manteve toxina botulínica e preenchimento labial como duas técnicas
  distintas, não promoveu marca ou ativo a procedimento, incluiu esterilização somente com reutilização e
  autoclave confirmadas, retornou 10 documentos e não expôs IDs, cobertura, modo, pontuação ou prompts.
- Evidência local do ajuste WAF: 16 arquivos e 61 testes aprovados; lint, TypeScript, readiness,
  `git diff --check` e build aprovados. Commit publicado em `origin/main`: `e9de691`.

---

## PV-008 — Manual de marca e design system

**Modelo:** gpt-5.6-terra · **Esforço:** alto · **Prioridade:** P1 visual · **Depende de:** manual
**Resultado:** identidade única para público, login e interno.

### Fonte e arquivos

- Usar o manual local somente neste card; não versionar o PDF sem autorização.
- Criar `docs/DESIGN.md`, shells, componentes UI e ativos aprovados em `public/brand/`.
- Modificar globals, layout, Tailwind e handoff; usar route groups sem mudar URLs.

### Implementação

- Extrair logo/margens/paleta/tipografia/hierarquia/usos proibidos; não inventar.
- Tema claro profissional, tokens semânticos, WCAG AA, foco e alvo mínimo 44 px.
- Shell interno responsivo; público sem menu administrativo; login de marca.

### Testes e aceite

- Build/testes, contraste, zoom 200%, teclado, 375/768/1440 e screenshots temporários.
- Nenhum valor visual arbitrário; rotas preservadas; manual não commitado.

### Fora de escopo

- Alterar fluxos.

### Commit

`style: establish PastaVISA brand system`

### Resultado — 09/08/2026

**Implementação local entregue.** O sistema visual agora centraliza os tokens do Manual de Marca TreinaVISA 2.0 sem versionar o PDF-fonte.

- `docs/DESIGN.md` registra fonte, paleta, tipografia, regras de logo, shells, acessibilidade e usos proibidos.
- O único ativo oficial disponível foi extraído sem alteração da página 1 do manual para `public/brand/treinavisa-logo-light.png`; a documentação proíbe recriar ou recolorir uma versão escura ausente.
- Route groups preservam as URLs: `(internal)` cobre `/`, `/pasta/*`, `/templates` e `/legislacoes`; `(public)` cobre `/login`, sem navegação administrativa.
- O shell interno ganhou navegação responsiva e o login usa a hierarquia de marca. Tokens semânticos, foco visível, alvos mínimos de 44 px e estados funcionais foram aplicados sem alterar APIs ou fluxos.
- O readiness e o teste de fronteira Auth foram atualizados apenas para o novo caminho físico da página de login; a rota pública continua `/login`.

#### Evidência local

- `npx.cmd tsc --noEmit`, `npm.cmd run test:run` (15 arquivos, 57 testes), `npm.cmd run lint`, `npm.cmd run check:deploy`, `git diff --check` e `npm.cmd run build`: aprovados.
- Pares de texto, CTA, estados e foco testados por fórmula WCAG AA: de 5,25:1 a 17,81:1; todos os pares de texto avaliados ficaram acima de 4,5:1.
- `GET /login` local retornou 200, com marca e sem `Templates` ou `Legislações`; o build gerou as nove rotas preservadas.

#### Limitação de validação visual

O navegador integrado desta task não alcançou `127.0.0.1` e o Chrome controlável não estava disponível. Portanto, screenshots e inspeção interativa em 375/768/1440 px, zoom 200% e teclado ainda exigem execução em um navegador local ou QA que alcance a aplicação. Nenhum screenshot temporário foi mantido.

#### Limpeza e escopo

- Renders temporários do manual e logs do servidor local foram removidos; o manual PDF permaneceu local, ignorado e sem modificação.
- Nenhuma API, regra de Auth, dado, migration, Storage, variável de ambiente, fluxo de negócio, deploy ou ação remota foi alterado.
- Commit de implementação: `3c77a71`.

### Correção de aceite — 10/08/2026

- Incorporadas as versões oficiais da logo para superfícies claras e escuras e os favicons correspondentes, fornecidos pela TreinaVISA. Os favicons foram reduzidos deterministicamente para 64 × 64 px, sem recoloração ou alteração de proporção.
- Adicionado tema claro/escuro com preferência inicial do sistema, seletor acessível e persistência local. Header público e shell interno usam a variante correta da logo para cada superfície.
- Corrigida a causa da logo quebrada em produção: o middleware de Auth interceptava `/brand/*` e podia devolver 503 aos próprios ativos públicos. O matcher agora exclui apenas esse diretório estático, sem liberar páginas ou APIs.
- O login voltou a usar validação nativa de `type="email"` e informa que é necessário digitar o e-mail completo. Nenhuma conta, senha, papel ou regra de autorização foi alterada neste card.

#### Evidência da correção

- `npm.cmd run test:run`: 16 arquivos e 61 testes aprovados; `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run check:deploy`, `git diff --check` e `npm.cmd run build`: aprovados.
- Navegador local: logos clara/escura com HTTP 200, alternância persistida após reload, sem overlay e sem erros de console.
- Larguras 375, 768 e 1440 px: logo, seletor e formulário visíveis, sem overflow horizontal. O teste de formato confirmou que `ester` isolado é inválido para o campo de e-mail.
- Correção versionada em `0c15e69` (`fix: correct PV-008 logos and theme`) e publicada em `origin/main`.
- O deployment do commit concluiu com sucesso no ambiente Production da Vercel. Smoke público no deployment: `/login` e os quatro ativos em `/brand/*` retornaram 200; `/` permaneceu protegido com redirecionamento 307 para `/login`; `/api/templates` permaneceu protegido com 401.
- No navegador de produção, os dois temas selecionaram a variante correta da logo, a escolha persistiu após reload, `ester` isolado permaneceu inválido no campo nativo de e-mail e não houve warning/erro de console ou overflow horizontal em 1280 px.
- Zoom exato de 200% e ordem completa de teclado continuam sem evidência automatizada e não foram declarados aprovados.

---

## PV-009 — Planner público e PDF

**Modelo:** gpt-5.6-sol · **Esforço:** alto · **Prioridade:** P1 comercial · **Depende de:** PV-007, PV-008
**Resultado:** comercial cria, ajusta e baixa sem login.

### Arquivos

- Criar página pública, componentes commercial-planner, rota PDF, `render-pdf.ts` e testes.
- Adicionar `pdf-lib` em package/lock; atualizar handoff.

### Implementação

- Cliente/local → operação → revisão → formato/preço → PDF.
- Usar o MCP DesignMD desde o início para definir o design system, os blocos do link público e a composição
  visual do PDF com estética profissional e premium; não substituir essa etapa silenciosamente por referência
  visual improvisada.
- Retirada recalcula documentos/adicional; comparar três formatos.
- PDF A4 em memória com logo/marca d’água, cliente, data, incluídos/retirados, documentos, contagem,
  preços, adicional, total, prazo e ressalva oficial.
- Sem catálogo, IDs, cobertura ou mecanismo técnico.

### Testes e aceite

- Teclado/celular, retirada, 100/101, PDF válido/marcado, termos proibidos ausentes e refresh limpo.
- Link público, preço recalculado no servidor e zero persistência.

### Fora de escopo

- Envio, assinatura e pagamento.

### Commit

`feat: add public commercial planner and PDF`

---

## PV-010 — Redesign interno principal

**Modelo:** gpt-5.6-terra · **Esforço:** alto · **Prioridade:** P2 · **Depende de:** PV-005, PV-008
**Resultado:** dashboard, criação, processamento e correção alinhados à marca.

### Arquivos e implementação

- Modificar dashboard, nova pasta, detalhe, edição, processamento e correção; reaproveitar UI.
- Dashboard com recentes/status/busca; formulários em seções; pasta com resumo/pendências/ações.
- Estados de processamento claros e erros que nomeiam template/logo/upload/banco/geração.
- Criar teste `internal-core-pages`; atualizar handoff.

### Testes e aceite

- Criar/editar/duplicar/processar/abrir, vazio/loading/erro, desktop/tablet/celular, teclado/foco/contraste.
- Nenhuma função desaparece; ação principal clara; sem overflow.

### Fora de escopo

- Templates, legislações e motor de geração.

### Commit

`style: redesign core PastaVISA workflows`

---

## PV-011 — Redesign de templates e legislações

**Modelo:** gpt-5.6-terra · **Esforço:** alto · **Prioridade:** P2 · **Depende de:** PV-003, PV-008
**Resultado:** administração menor, legível e testável.

### Arquivos e implementação

- Refatorar páginas e criar componentes `components/templates/` e `components/legislacoes/`.
- Preservar APIs, filtros, importação, preview, duplicação, variáveis, versões e restauração.
- Confirmar destrutivas pelo nome; legislação com filtros; somente `admin`.
- Criar testes administrativos; atualizar handoff.

### Testes e aceite

- CRUD/importação/duplicação/restauração, 403 operador e falhas de arquivo/API/validação.
- API preservada, lógica dividida, destrutivas seguras e catálogo não público.

### Fora de escopo

- Revisar conteúdo dos 295 registros.

### Commit

`refactor: modernize template and legislation management`

---

## PV-012 — E2E, segurança e homologação

**Modelo:** gpt-5.6-sol · **Esforço:** alto · **Prioridade:** P1 lançamento · **Depende de:** PV-009, PV-010, PV-011
**Resultado:** versão publicada e comprovada ponta a ponta.

### Arquivos e implementação

- Adicionar Playwright, config/specs em `tests/e2e/` e `scripts/check-public-boundary.mjs`.
- Rotacionar QA em memória; criar e limpar pasta/DOCX QA.
- Testar anônimo/operador/admin, planner/PDF e correção/preview/download/restauração.
- Auditar respostas/logs/bundles; confirmar firewall, Advisor e Vercel `Ready`; registrar rollback.

### Testes e aceite

- Testes Vitest/E2E, build, lint, readiness, public-boundary e smokes público/autenticado.
- Provar limpeza de QA no banco/Storage.
- Fluxos críticos passam; SHA Vercel correto; planner sem persistência/exposição; handoff final completo.

### Fora de escopo

- CRM, cobrança, envio, histórico e pasta definitiva automática.

### Commit

`chore: harden PastaVISA production release`

---

## PV-013 — Rota de teste e dependência crítica

**Modelo:** gpt-5.6-terra · **Esforço:** baixo · **Prioridade:** P0 higiene · **Depende de:** —
**Resultado:** produção sem rota que cria dados falsos e sem a única vulnerabilidade crítica.

### Contexto

Dois achados independentes, ambos de correção trivial e risco funcional nulo:

1. `app/api/pastas/teste/route.ts` cria uma `Pasta` completa de mentira (“Clínica Teste”, CNPJ
   `00.000.000/0001-00`, RT fictícia) mais 3 `DocumentoGerado`, direto no banco. Está atrás do
   middleware, então exige login — mas **qualquer conta interna, incluindo `operador`, pode poluir a
   produção com um único POST**, e não há caminho de UI que a use.
2. `docxtemplater-image-module-free@1.1.1` está em `dependencies` mas **não é importado em lugar
   nenhum** (`grep` por `docxtemplater-image-module-free` e `ImageModule` em `lib/`, `app/` e
   `scripts/` não retorna nada). Ele é a única origem de `xmldom@0.1.31`, a **vulnerabilidade
   crítica sem correção disponível** do grafo.

### Arquivos

- Remover `app/api/pastas/teste/route.ts`.
- Modificar `package.json` e `package-lock.json` (remover `docxtemplater-image-module-free`).
- Modificar `docs/HANDOFF.md`.

### Implementação

- Antes de remover a rota, confirmar por busca que nenhum componente, teste ou script chama
  `/api/pastas/teste`. Se houver chamador, o card muda de escopo — registre e pare.
- `npm.cmd uninstall docxtemplater-image-module-free`. Não executar `npm audit fix` neste card:
  a remoção deve ser a única mudança de grafo, para que a queda de vulnerabilidades seja atribuível.
- Registrar o `npm audit` antes e depois no resultado.

### Testes e aceite

- `npm.cmd run test:run`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run check:deploy` e
  `npm.cmd run build` aprovados.
- `npm audit` deixa de listar `xmldom` e a contagem de críticas cai para **0**.
- Smoke em produção: `POST /api/pastas/teste` autenticado retorna 404.
- Nenhuma `Pasta` real removida. Se já existirem pastas de teste no banco, **apenas registrar a
  contagem** — a exclusão é decisão da Ester, não deste card.

### Fora de escopo

- Atualizar qualquer outra dependência, mexer em `next`, `sharp` ou executar `npm audit fix`.
- Apagar dados existentes.

### Commit

`chore: remove test route and unused image module`

---

## PV-014 — Senha vazada e redução de vulnerabilidades

**Modelo:** gpt-5.6-sol · **Esforço:** médio · **Prioridade:** P1 segurança · **Depende de:** PV-013
**Resultado:** proteção contra senha vazada ativa e grafo sem altas corrigíveis por patch.

### Contexto

- O Advisor de segurança do Supabase reporta `WARN auth_leaked_password_protection`: a verificação
  contra HaveIBeenPwned está desligada no projeto `imywcumdngkzkeszvyxv`. Com apenas duas contas
  internas o risco é baixo, mas a correção é uma chave no painel.
- Depois do PV-013 restam 13 altas. Elas se dividem em dois grupos com risco muito diferente:
  **corrigíveis sem major** (`brace-expansion`, `fast-uri`, `js-yaml`, `deepmerge-ts`,
  `@prisma/config`, `prisma`, `hono`, `postcss` transitivo) e **exigindo major**
  (`next` 14→16, `eslint-config-next` 14→16, `sharp` 0.34→0.35).

### Implementação

- Ativar a proteção de senha vazada no Supabase Auth. Registrar que foi ativada; **não** registrar
  nenhum valor de configuração.
- Aplicar **somente** as atualizações sem major, uma leva por vez, com build e suíte entre elas.
- **Não** subir `next` para 16 neste card. A major traz mudanças de App Router e o projeto tem 9
  páginas, 37 rotas e um middleware de Auth em produção — isso é um card próprio, com smoke completo.
  Registrar aqui a lista de CVEs do `next` 14.2.35 e a recomendação, sem executar.
- `sharp` 0.35 mexe em geração de logo e DOCX. Se entrar, exige teste visual de logo clara/escura em
  documento real antes do push; se não houver como testar, adiar e registrar.

### Testes e aceite

- Suíte, TypeScript, lint, `check:deploy` e build aprovados após cada leva.
- `npm audit` registrado antes e depois; queda de altas comprovada por número.
- Login e logout continuam funcionando em produção com as duas contas.
- Geração de um DOCX real com logo continua abrindo no Word, se `sharp` tiver sido tocado.

### Fora de escopo

- Migração para Next 16 e qualquer alteração de comportamento de aplicação.

### Commit

`security: enable leaked password protection and patch dependencies`

---

## PV-015 — Superfície de `/api/health`

**Modelo:** gpt-5.6-terra · **Esforço:** baixo · **Prioridade:** P2 segurança · **Depende de:** —
**Resultado:** health check público sem contagem de dados nem detalhe interno.

### Contexto

`/api/health` é público (`isPublicPath`) e responde com `pastaCount` — o número real de pastas de
clientes em produção — mais a lista completa de checks de readiness por nome. Não expõe segredo, mas
entrega telemetria de negócio e mapa de configuração a qualquer visitante do domínio.

### Implementação

- Manter público apenas `{ ok, storageDriver }` e o status HTTP (200/503), que é o que um health
  check externo precisa.
- Mover `pastaCount` e `readiness.checks` para trás de autenticação: ou uma rota interna separada, ou
  a mesma rota respondendo o corpo detalhado somente quando houver sessão válida.
- Preservar o contrato de status: 503 quando readiness ou banco falham.

### Testes e aceite

- Teste cobrindo: anônimo não recebe `pastaCount` nem `readiness`; autenticado recebe; o código de
  status continua igual nos dois casos.
- Smoke em produção anônimo confirmando o corpo reduzido.

### Fora de escopo

- Alterar o que `getReadinessSummary` verifica.

### Commit

`security: reduce public health endpoint surface`

---

## PV-016 — Modelo do motor sanitário

**Modelo:** gpt-5.6-sol · **Esforço:** médio · **Prioridade:** P2 · **Depende de:** PV-006
**Resultado:** planner comercial em modelo atual, com qualidade sanitária comprovada por teste.

### Contexto

`lib/ai.ts:46` usa `claude-sonnet-4-5-20250929` no `runCommercialPlannerAnalysis`. O modelo continua
ativo e sem aposentadoria anunciada, então **isto não é urgente**. Os outros quatro pontos de
`lib/ai.ts` usam `claude-haiku-4-5-20251001`, que é modelo atual — **não mexer neles**.

Se a Ester quiser mais precisão sanitária, o alvo é `claude-sonnet-5` ou `claude-opus-5`. Nenhuma
chamada usa `temperature`, `top_p` ou `budget_tokens`, então não há mudança quebrando a migração —
mas há mudanças de comportamento relevantes:

- Em `claude-sonnet-5` e `claude-opus-5` o *thinking* adaptativo passa a rodar quando o campo é
  omitido. Como `max_tokens` limita pensamento **mais** resposta, os `max_tokens: 8192` atuais podem
  truncar. Revisar antes de trocar.
- `claude-sonnet-5` usa tokenizador novo: o mesmo texto rende cerca de 30% mais tokens. Recalcular
  custo e limites com `count_tokens` contra o modelo novo, sem aplicar multiplicador de memória.

### Implementação

- Trocar apenas a linha 46. Manter os quatro pontos em `claude-haiku-4-5`.
- Revisar `max_tokens` e o `effort` do pedido.
- Rodar a suíte sanitária de `tests/commercial-planner/` inteira contra o modelo novo e comparar a
  saída caso a caso: produto/marca não vira procedimento, toxina e preenchimento continuam distintos,
  esterilização só com reutilização e autoclave, TCLE amplo não absorve específico sem equivalência.

### Testes e aceite

- 12 testes sanitários aprovados **e** comparação manual das saídas antes/depois registrada.
- Nenhum campo interno (ID, cobertura, pontuação, prompt) aparece na saída pública.
- Smoke no alias de produção com o mesmo pedido usado no fechamento do PV-007.

### Fora de escopo

- Trocar os modelos de extração; alterar prompts sanitários.

### Commit

`feat: update commercial planner model`

---

## PV-017 — Limpeza de artefatos locais

**Modelo:** gpt-5.6-terra · **Esforço:** baixo · **Prioridade:** P3 · **Depende de:** —
**Resultado:** checkout sem restos de sessões anteriores.

### Implementação

Remover, conferindo o caminho absoluto antes de qualquer remoção recursiva:

- `C:\Saas\PASTAVISA\.pv008-dev.log` e `.pv008-dev.err.log` — logs de servidor local do PV-008.
- `C:\Saas\PASTAVISA\tsconfig.tsbuildinfo` e `C:\Saas\PASTAVISA\.next` — caches de build.
- `C:\Saas\PASTAVISA\entregas\templates-subcisao` — diretório **vazio**, criado em 16/08/2026, sem
  card correspondente. Antes de remover, perguntar à Ester se havia trabalho previsto de templates de
  subcisão; se houver, abrir card em vez de apagar.

Preservar: `node_modules`, o manual de marca PDF, `public/brand/`, tudo rastreado pelo git e qualquer
backup.

### Testes e aceite

- `git status` continua limpo; `npm.cmd run build` reconstrói normalmente.
- Registrar exatamente o que foi removido.

### Commit

Sem commit de código; apenas o registro no handoff.

---

## PV-018 — Fechar o aceite de acessibilidade do PV-008

**Modelo:** gpt-5.6-terra · **Esforço:** baixo · **Prioridade:** P1 visual · **Depende de:** PV-008
**Resultado:** os dois critérios que o PV-008 deixou sem evidência, comprovados.

### Contexto

O PV-008 foi publicado e o smoke de produção passou, mas o próprio resultado declara: “Zoom exato de
200% e ordem completa de teclado continuam sem evidência automatizada e não foram declarados
aprovados.” O card ficou marcado como concluído com esses dois itens em aberto.

### Implementação

Em navegador real, em `/login` e no shell interno:

- Zoom de 200% em 1280 px de largura: sem overflow horizontal, sem texto cortado, sem sobreposição.
- Percurso completo por `Tab`: ordem lógica, foco sempre visível, seletor de tema alcançável e
  operável por teclado, nenhum elemento focável fora da tela.
- Alvos de toque mínimos de 44 px conferidos nos controles principais.

Onde for possível, transformar o que foi verificado em teste em `tests/ui/`, para não depender de
inspeção manual na próxima vez.

### Testes e aceite

- Evidência descrita item a item no resultado, incluindo o que falhou e foi corrigido.
- Suíte, lint, TypeScript e build aprovados se houver mudança de código.
- Screenshots temporários removidos ao fim do card.

### Fora de escopo

- Redesenhar telas; isso é PV-010 e PV-011.

### Commit

`fix: complete PastaVISA accessibility acceptance`

---

## 6. Registro de execução

| Data | Card | Estado | Commit | Produção | Observação |
|---|---|---|---|---|---|
| 08/08/2026 | PV-000 | Concluído | `146b73c` | Vercel `success`; sem ação funcional | Handoff único publicado; temporários removidos. |
| 08/08/2026 | PV-001 | Concluído | `c0d072a` | Nenhuma ação remota | Vitest configurado; build, lint e 2 testes passaram. |
| 08/08/2026 | Ajuste correção em lote | Concluído | `2a31f1e` | Push em `origin/main` | Exclusão múltipla estrita; restante do PV-005 continua pendente. |
| 08/08/2026 | PV-006 | Concluído | `a60cc73` | Push em `origin/main`; smoke Production aprovado em 10/08 | Motor sanitário server-only; resposta 200 com duas técnicas distintas, esterilização condicionada e saída sem campos internos. |
| 09/08/2026 | PV-008 | Implementação local | `3c77a71` | Nenhuma ação remota | Design system, shells e ativo oficial; screenshot/zoom/teclado em navegador local ou QA pendentes. |
| 10/08/2026 | PV-007 | Concluído | `e9de691` | Vercel Production `Ready`; WAF `live`; 429 comprovado | Segredo sensível configurado; uma regra Hobby para os dois POSTs; observação, revisão e publicação concluídas. |
| 10/08/2026 | PV-008 | Correção publicada | `0c15e69` | Vercel Production `success`; smoke público aprovado | Logos e favicons 200, tema persistente, login 200 e fronteira interna preservada; zoom 200% e ordem completa de teclado pendentes. |
| 09/08/2026 | PV-002 | Concluído | `1a03f6f` | Migration aplicada em `imywcumdngkzkeszvyxv` | Registro reconstruído na auditoria de 17/08. RLS ativa e **zero grants** para `anon`/`authenticated` confirmados em produção. |
| 09/08/2026 | PV-003 | Concluído | `b7d1272` | 2 contas criadas em `auth.users` | Registro reconstruído na auditoria de 17/08. `lib/session-auth.ts` removido; 1 `admin` e 1 `operador`, ambos com papel em `app_metadata`. |
| 17/08/2026 | Auditoria de retomada | Concluído | `443f27e` | Nenhuma ação remota | Estado real medido contra código, Supabase e Vercel. Mapa de cards corrigido (PV-002/PV-003 estavam marcados como pendentes). Abertos PV-013 a PV-018. |
| 17/08/2026 | PV-004 | Concluído | `9ed5856` | Nenhuma ação remota | Motor de substituição reescrito com preflight, trava de hash 409 e preservação estrutural. 95 testes aprovados. `hashOrigem` opcional até o PV-005 ligar analisar → aplicar. |
