# Handoff único — PASTAVISA

**Última atualização:** 09/08/2026 (BRT), durante a implementação do PV-007
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

## 2. Estado verificado em 08/08/2026

### 2.1 Checkout e Git

- Checkout fora do OneDrive em `C:\Saas\PASTAVISA`.
- `main = origin/main = c071873d2e151fdbc0ba6575d9ba1f0e6f69498a` no início do PV-000.
- Remoto: `https://github.com/EsterSouza/pastavisa.git`.
- O diretório já continha `TreinaVISA - Manual de Marca 2.0.pdf`; foi preservado, está ignorado por
  `/*.pdf` e não pertence ao PV-000.
- O projeto declara Node `22.x`; a máquina usa Node `v25.8.0` e npm `11.11.0`. O build deve ser a
  evidência, sem atribuir falha apenas ao aviso de engine.
- GitHub CLI instalado, mas a sessão `gh` local estava com token inválido. Fetch público funcionou
  por git; o push precisa ser comprovado no resultado.

### 2.2 Código

| Item | Estado |
|---|---:|
| Páginas `page.tsx` | 9 |
| Rotas API `route.ts` | 36 |
| Modelos em `prisma/schema.prisma` | 8 |
| Migrations Prisma | 13 |
| Migrations Supabase versionadas | 6 |
| Stack | Next.js 14.2.35, React 18, Tailwind 3.4.1, Prisma 7.8 |
| Arquivos | filesystem local ou Supabase Storage |
| Geração | DOCX, docxtemplater/PizZip, Mammoth, Sharp e Anthropic |
| Testes no início | sem runner automatizado configurado |

`npm.cmd ci` instalou 607 pacotes e o audit do npm informou 18 vulnerabilidades no grafo atual:
6 moderadas, 11 altas e 1 crítica. O PV-000 não executou `npm audit fix` nem alterou dependências;
o PV-001 deve registrar o baseline detalhado antes de qualquer correção seletiva.

Scripts: `dev`, `build`, `start`, `check:deploy`, `backup:local`, `migrate:local-to-supabase`,
`migrate:storage-to-supabase`, `repair:docx`, `lint` e `sync:templates`.

### 2.3 Supabase de produção

Projeto confirmado: `pastavisa`, ref `imywcumdngkzkeszvyxv`.

| Objeto | Estado em 08/08/2026 |
|---|---:|
| `Template` | 295 registros |
| `Pasta` | 6 registros |
| `storage.objects` | 1.236 objetos |
| `auth.users` | 0 usuários |
| `hotmart_vendas` | RLS desligada; `SELECT` para `anon`/`authenticated`; zero policies |
| `manychat_leads` | RLS desligada; sem grant de navegador listado; zero policies |

O PV-000 não altera o banco. O risco das duas tabelas pertence exclusivamente ao PV-002. A contagem
de Storage não prova objetos órfãos; não apagar objetos sem auditoria de referências.

### 2.4 Vercel

- Código e documentação histórica apontam para `pasta-visa` na conta da Ester.
- Link fornecido: `https://vercel.com/estersouzas-projects/pasta-visa`.
- A conexão Vercel desta task retornou zero equipes; projeto, envs, deployment e smoke autenticado
  não foram comprovados no início do PV-000.
- `vercel.json` define apenas o schema e `framework: nextjs`.
- Push na `main` normalmente dispara produção, mas `Ready` não substitui smoke.

### 2.5 Auth e fronteira pública

- `middleware.ts` protege tudo, exceto `/login` e `/api/auth/*`.
- Auth atual usa `APP_BASIC_AUTH_USER`, `APP_BASIC_AUTH_PASSWORD` e cookie HMAC em
  `lib/session-auth.ts`; não existem usuários Supabase Auth.
- Supabase Auth e papéis `admin`/`operador` pertencem ao PV-003.
- O planner público ainda não existe.

### 2.6 Correção de documentos prontos

- UI: `app/pasta/[id]/corrigir-lote/page.tsx`.
- Aplicação: `app/api/pastas/[id]/uploads-corrigidos/aplicar/route.ts` e
  `lib/header-footer-replace.ts`.
- Usa pares antigo/novo e logo, processa sequencialmente e cria `DocumentoUploadVersao`.
- Não há preflight com contagem/contexto, hash de origem ou restauração.
- O fallback para texto dividido entre runs concentra o parágrafo no primeiro run e pode degradar
  formatação mista. A correção pertence aos PV-004/PV-005.

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

| Card | Entrega | Modelo | Esforço | Prioridade | Depende de | Estado |
|---|---|---|---|---|---|---|
| PV-000 | Checkout e handoff único | gpt-5.6-terra | médio | P0 | — | Concluído |
| PV-001 | Fundação de testes | gpt-5.6-terra | médio | P0 | PV-000 | Concluído |
| PV-002 | Fechamento de tabelas expostas | gpt-5.6-sol | alto | P0 segurança | PV-000 | Pendente |
| PV-003 | Supabase Auth, papéis e QA | gpt-5.6-sol | alto | P0 segurança | PV-001, PV-002 | Pendente |
| PV-004 | Motor seguro de substituição | gpt-5.6-sol | xhigh | P1 principal | PV-001, PV-003 | Pendente |
| PV-005 | Fluxo visual de correção | gpt-5.6-terra | alto | P1 principal | PV-004 | Pendente |
| PV-006 | Motor sanitário do planner | gpt-5.6-sol | xhigh | P1 sanitário | PV-001 | Concluído |
| PV-007 | API pública, preços e proteção | gpt-5.6-sol | alto | P1 segurança | PV-003, PV-006 | Em implementação; WAF bloqueado pelo plano |
| PV-008 | Manual de marca e design system | gpt-5.6-terra | alto | P1 visual | Manual | Pendente |
| PV-009 | Planner público e PDF | gpt-5.6-sol | alto | P1 comercial | PV-007, PV-008 | Pendente |
| PV-010 | Redesign interno principal | gpt-5.6-terra | alto | P2 visual | PV-005, PV-008 | Pendente |
| PV-011 | Redesign templates/legislações | gpt-5.6-terra | alto | P2 manutenção | PV-003, PV-008 | Pendente |
| PV-012 | E2E e homologação final | gpt-5.6-sol | alto | P1 lançamento | PV-009, PV-010, PV-011 | Pendente |

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
- Vercel: análise 10 POST/5 min/IP, PDF 20 POST/5 min/IP e métodos estritos.
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

## 6. Registro de execução

| Data | Card | Estado | Commit | Produção | Observação |
|---|---|---|---|---|---|
| 08/08/2026 | PV-000 | Concluído | `146b73c` | Vercel `success`; sem ação funcional | Handoff único publicado; temporários removidos. |
| 08/08/2026 | PV-001 | Concluído | `c0d072a` | Nenhuma ação remota | Vitest configurado; build, lint e 2 testes passaram. |
| 08/08/2026 | Ajuste correção em lote | Concluído | `2a31f1e` | Push em `origin/main` | Exclusão múltipla estrita; restante do PV-005 continua pendente. |
| 08/08/2026 | PV-006 | Concluído | `a60cc73` | Push em `origin/main`; deployment não verificado | Motor sanitário server-only; 12 testes focados e saída pública sanitizada. |
| 09/08/2026 | PV-008 | Implementação local | `3c77a71` | Nenhuma ação remota | Design system, shells e ativo oficial; screenshot/zoom/teclado em navegador local ou QA pendentes. |
