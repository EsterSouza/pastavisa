# PastaVISA / Pastavirus - Contexto tecnico para handoff

Este arquivo resume a arquitetura, fluxos, modulos e pontos sensiveis do projeto PastaVISA, para que outro chat/agente consiga continuar o trabalho sem reabrir todo o historico.

## 1. Visao geral

PastaVISA e um app Next.js para criar e gerar "pastas sanitarias" personalizadas a partir de:

- PDF do forms.app preenchido pelo cliente.
- Arquivo `.docx` "Documentos em Elaboracao" com dados, lista de documentos, referencias, servicos, equipamentos e insumos.
- Biblioteca de templates `.docx`.
- Biblioteca de legislacoes/referencias.

O sistema extrai dados com IA, permite revisao, cria uma pasta no banco, associa templates a documentos sugeridos e gera arquivos `.docx` finais com substituicao de variaveis, adaptacao por IA e referencias.

Stack principal:

- Next.js 14 App Router.
- React 18 + Tailwind.
- Prisma 7 com client gerado em `app/generated/prisma`.
- SQLite local e Postgres/Supabase em producao.
- Supabase Storage ou filesystem local para uploads/templates/logos/output.
- Anthropic Claude para extracao e adaptacao de texto.
- `docxtemplater`, `pizzip`, Mammoth, `pdf-parse`, `archiver`, `sharp`.

## 2. Comandos importantes

Rodar local:

```powershell
npm.cmd run dev
```

Build e readiness antes de publicar:

```powershell
npm.cmd run build
npm.cmd run check:deploy
```

Backup local:

```powershell
npm.cmd run backup:local
```

Migracao para Supabase:

```powershell
npm.cmd run migrate:local-to-supabase
npm.cmd run migrate:storage-to-supabase
```

Sync de templates locais para Supabase:

```powershell
npm.cmd run sync:templates
```

Reparar DOCX corrompido:

```powershell
npm.cmd run repair:docx
```

## 3. Variaveis de ambiente

Arquivo de referencia: `.env.example`.

Principais:

```env
ANTHROPIC_API_KEY=
DATABASE_URL=
FILE_STORAGE_DRIVER=local
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=pasta-visa
TEMPLATE_SOURCE_DIR=
APP_BASIC_AUTH_USER=
APP_BASIC_AUTH_PASSWORD=
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para cliente/browser.
- Em Vercel/producao, `FILE_STORAGE_DRIVER=supabase`.
- O app ainda usa Basic Auth temporario via middleware.

## 4. Modelo de dados

Schemas:

- Local SQLite: `prisma/schema.prisma`
- Supabase/Postgres: `prisma/schema.supabase.prisma`

Modelos principais:

### `Pasta`

Representa uma pasta sanitaria em rascunho/processamento/concluida.

Campos relevantes:

- Dados cadastrais: `clienteNomeFantasia`, `clienteRazaoSocial`, `clienteCnpj`, `clienteEndereco`, `clienteCidade`, `clienteEstado`, `clienteEstadoExtenso`, `clienteTelefone`, `clienteEmail`, `clienteHorario`.
- Responsaveis: `clienteProprietarioNome`, `clienteRtNome`, `clienteRtProfissao`, `clienteRtConselho`, `clienteResponsaveisTecnicos`.
- Dados operacionais: `clienteEstrutura`, `clienteMemorialDescritivoMbp`, `clienteServicos`, `clienteFuncionarios`, `clienteEquipamentos`, `clienteProdutosInsumos`, `clienteTerceirizados`.
- Residuos/coleta: `clienteColetaRazao`, `clienteColetaCnpj`, `clienteResiduosA`, `clienteResiduosD`, `clienteResiduosE`.
- Arquivos: `formsPdfPath`, `documentosElaboracaoPath`, `clienteLogoPath`.
- Logo: `clienteLogoBgHex` (hex da cor de fundo da caixa da logo no cabecalho; opcional).
- Legislacoes selecionadas: `legislacaoIds` JSON string.

Listas complexas sao salvas como JSON string.

### `DocumentoGerado`

Documento dentro de uma pasta.

Campos relevantes:

- `pastaId`, `templateId`, `nomeArquivo`, `outputPath`, `status`.
- `tokensUsados`, `mensagemErro`.
- `avisoRtNoCorpo`, `logoSubstituida`.
- `equipamentosSelecionados`: JSON string para equipamentos/insumos selecionados em POP especifico.

### `DocumentoVersao`

Historico de versoes geradas para cada documento.

### `Template`

Template base `.docx`.

Campos:

- `nome`, `tipo`, `padraoHeader`, `processingType`, `arquivoPath`, `ativo`.
- `processingType`: `HEADER_ONLY`, `LIGHT_HAIKU`, `HEAVY_HAIKU`, `SONNET_REQUIRED`.

### `TemplateVersao`

Historico de versoes de template.

### `Legislacao`

Biblioteca de legislacoes/referencias:

- `estadoUf`, `municipio`, `tipo`, `titulo`, `referenciaAbnt`, `destaqueAbnt`, `chaveReferencia`, `ativo`.

## 5. Estrutura de pastas

Arquivos principais:

```text
app/
  page.tsx                         Lista de pastas
  login/page.tsx                   Login Basic Auth
  pasta/nova/page.tsx              Upload PDF + DOCX, revisao inicial
  pasta/[id]/page.tsx              Detalhe/resumo da pasta
  pasta/[id]/editar/page.tsx       Edicao dos dados do cliente
  pasta/[id]/processar/page.tsx    Tela de selecao/processamento dos documentos
  templates/page.tsx               CRUD/importacao de templates
  legislacoes/page.tsx             CRUD/importacao de legislacoes
  api/...                          Rotas server-side

lib/
  ai.ts                            Chamadas Anthropic e prompts
  generator.ts                     Geracao DOCX, variaveis, AI_ADAPT, referencias
  file-storage.ts                  Storage local/Supabase
  extractor.ts                     Extracao PDF/DOCX
  document-list-extractor.ts       Fallback deterministico de lista de documentos
  client-data-fallback.ts          Fallback de dados cadastrais pelo DOCX
  template-matcher.ts              Matching doc sugerido -> template
  classifier.ts                    Tipo de processamento/modelo por template
  legislation-matcher.ts           Associacao de legislacoes existentes
  reference-extractor.ts           Referencias nao cadastradas a partir do DOCX
  reference-deduplication.ts       Normalizacao/dedupe de referencias
  template-variables.ts            Catalogo de variaveis suportadas
  template-validator.ts            Validacao de templates
  logo-replacer.ts                 Insercao/substituicao de logo
  docx-preview.ts                  Preview HTML de DOCX
  docx-validator.ts                Validacao/reparo basico
  env-readiness.ts                 Health/readiness
  session-auth.ts                  Basic Auth/session cookie

scripts/
  check-deploy-readiness.js
  backup-local-data.js
  migrate-local-to-supabase.js
  migrate-local-storage-to-supabase.js
  sync-local-templates-to-supabase.js
  repair-corrupted-docx.js

storage/
  uploads/
  templates/
  logos/
  output/
```

## 6. Fluxo principal: criar nova pasta

Tela: `app/pasta/nova/page.tsx`

1. Usuario envia:
   - PDF do forms.app.
   - DOCX "Documentos em Elaboracao".
2. Para uploads grandes em Supabase, a tela usa `/api/uploads/sign` e upload direto para Supabase Storage.
3. Chama `/api/extrair`.
4. Recebe:
   - `data`: dados do cliente extraidos.
   - `documentosAGerar`: documentos sugeridos.
   - `legislacoesAssociadas`.
   - `referenciasNaoCadastradas`.
   - preview dos primeiros 600 caracteres do DOCX para diagnostico visual.
5. Usuario revisa documentos e referencias.
6. Chama `/api/extrair/confirmar`.
7. API cria `Pasta` e `DocumentoGerado[]`.
8. Redireciona para edicao/processamento.

## 7. Extracao inicial: `/api/extrair`

Arquivo: `app/api/extrair/route.ts`

Responsabilidades:

- Receber PDF + DOCX via multipart ou referencias Supabase.
- Salvar arquivos em storage.
- Extrair texto do DOCX com Mammoth.
- Enviar PDF como documento base64 para Claude.
- Chamar `extractClienteData` em `lib/ai.ts`.
- Se dados importantes vierem incompletos, chamar `extractClienteDataFromElaboracaoText` focada no DOCX.
- Complementar dados pelo fallback deterministico `client-data-fallback.ts`.
- Extrair lista de documentos do DOCX via `document-list-extractor.ts` e mesclar com retorno da IA.
- Associar legislacoes existentes e detectar referencias nao cadastradas.

Pontos criticos:

- PDF deve ir como base64/document para Claude. Ja houve problema quando se tentou substituir por `pdf_text` local; isso quebrou PDFs escaneados/grandes.
- O preview de "primeiros 600 caracteres" e apenas visual; a IA recebe o texto completo do DOCX.
- A extracao focada do DOCX existe porque a chamada unica pode ficar sobrecarregada quando ha PDF + DOCX grande + lista enorme.
- Os campos "Sim/Nao" indevidos sao tratados como vazios em fallback.

## 8. IA: `lib/ai.ts`

Principais exportacoes:

- `ClienteData`: contrato dos dados estruturados do cliente.
- `PdfInput`: atualmente `{ type: "pdf_base64"; data: string }`.
- `extractClienteData(pdfInput, elaboracaoText)`: extracao inicial com PDF + DOCX.
- `extractClienteDataFromElaboracaoText(elaboracaoText)`: segunda extracao focada em dados cadastrais/operacionais do DOCX quando a primeira vem incompleta.
- `adaptTrecho(trechoOriginal, clienteData, modelo?)`: adapta texto bruto para novo cliente.
- `detectBlockType(blockContent)`: detecta se bloco AI_ADAPT e instrucao, conteudo ou tabela.
- `processAdaptBlock(...)`: processa bloco AI_ADAPT com prompts especializados.

Modelos:

- Extracao: `claude-haiku-4-5-20251001`.
- Geracao/adaptacao: definido por `classifier.ts`, Sonnet para casos complexos e Haiku para os demais.

Prompt/estilo atual:

- Objetivo: texto tecnico, formal, em voz ativa, com perspectiva de RT/equipe.
- Evitar texto de auditoria, recomendacoes, promessas, secoes extras, referencias inventadas.
- AI_ADAPT deve retornar somente texto final, sem markdown, sem explicacoes.
- Tabelas AI_ADAPT retornam JSON para conversao OOXML.

## 9. Fallbacks importantes

### `lib/document-list-extractor.ts`

Extrai documentos do texto do DOCX independentemente da IA.

Detecta titulos como:

- POP
- MBP
- PGRSS
- TCLE
- Manual
- Plano
- Planilha
- Ficha
- Termo
- Guia
- Registro
- Formulario
- Protocolo
- Procedimento

Remove linhas de legislacao/referencias e faz dedupe por titulo normalizado.

Motivo: em documentos grandes, a IA ja retornou `documentos_a_gerar: []` mesmo com lista presente.

### `lib/client-data-fallback.ts`

Complementa dados do cliente a partir do texto do DOCX.

Preenche campos como:

- Nome fantasia, razao social, CNPJ.
- Endereco, cidade, UF, estado por extenso.
- Telefone, email, horario.
- RT, profissao, conselho.
- Proprietario quando a IA retorna "Sim" indevidamente.

Observacao: esse fallback e mais deterministico e nao substitui listas completas de equipamentos/insumos quando a IA ja trouxe algo bom.

### Segunda extracao focada

`extractClienteDataFromElaboracaoText` busca restabelecer o comportamento esperado de autopreenchimento completo:

- Dados comerciais.
- Servicos/procedimentos.
- Funcionarios/equipe.
- Terceirizados e coleta.
- Equipamentos.
- Produtos/insumos/medicamentos/cosmeticos.
- Estrutura fisica.

Ela roda somente se campos importantes vierem vazios da primeira extracao.

## 10. Confirmacao: `/api/extrair/confirmar`

Arquivo: `app/api/extrair/confirmar/route.ts`

Entrada:

- `pdfPath`
- `docxPath`
- `data`
- `documentosSelecionados`
- `legislacaoIds`

Faz:

- Cria `Pasta`.
- Salva listas complexas em JSON string.
- Busca templates ativos.
- Para cada documento selecionado, usa `findBestTemplateMatch`.
- Cria `DocumentoGerado` pendente com `templateId` quando encontrado.

## 11. Matching de templates

Arquivo: `lib/template-matcher.ts`

Responsavel por conectar o nome do documento sugerido ao template mais adequado.

Tecnicas:

- Normalizacao sem acentos.
- Stop words.
- Sinonimos.
- Aliases de tipos (`mbp`, `pgrss`, `pop`, `psp`, `tcle`).
- Dice score.
- Overlap contiguo.
- Penalidade por tokens prioritarios ausentes.
- Score minimo default: `62`.

Usado em:

- Confirmacao da pasta.
- Auto-template na tela de processamento.

## 12. Fluxo de edicao

Tela: `app/pasta/[id]/editar/page.tsx`

Permite editar:

- Dados do estabelecimento.
- Proprietario.
- RT principal.
- RTs por setor.
- Estrutura fisica.
- Memorial MBP.
- Servicos.
- Funcionarios.
- Equipamentos.
- Produtos/insumos.
- Terceirizados.
- Coleta de residuos.
- Quantidade de residuos.
- Logo do cliente.

Ao salvar, chama `PATCH /api/pastas/[id]`.

Observacao: ja houve texto mojibake em algumas labels (`Proprietario`, `Variaveis`, etc.). Conferir encoding se isso reaparecer.

## 13. Fluxo de processamento/geracao

Tela: `app/pasta/[id]/processar/page.tsx`

Funcionalidades:

- Lista documentos pendentes/gerados/erro.
- Permite trocar template.
- Auto-preencher templates.
- Associar/adicionar legislacoes.
- Selecionar equipamentos/insumos para POP.
- Gerar documentos selecionados.
- Preview e download.

API principal: `POST /api/gerar`

## 14. Geracao DOCX: `lib/generator.ts`

Modulo mais critico do sistema.

Responsabilidades:

- Abrir template DOCX com PizZip/docxtemplater.
- Substituir variaveis.
- Processar logo.
- Processar blocos `[AI_ADAPT_START]...[AI_ADAPT_END]`.
- Detectar se bloco e instrucao, conteudo ou tabela.
- Chamar IA para adaptar/gerar conteudo.
- Converter texto/tabela para OOXML.
- Injetar referencias legislativas ABNT.
- Injetar equipamentos/insumos na secao de materiais de POPs quando aplicavel.
- Gerar nome de arquivo seguro.
- Salvar no storage local ou Supabase.
- Criar versoes.

Variaveis montadas em `gerarDocumento` incluem:

- Dados cadastrais.
- RT/proprietario/multiplos RTs.
- Estrutura, servicos, funcionarios, equipamentos, produtos/insumos.
- Terceirizados e residuos.
- Emissao/revisao/versao/elaborador.
- Legislacoes federal/estadual/municipal.
- Lista de documentos da pasta.

Funcoes uteis:

- `gerarDocumento`
- `hasRtInBody`
- `createOutputDocxFileName`
- `tableJsonToOoxml`

Pontos sensiveis:

- Nao quebrar OOXML. Pequenas mudancas em XML podem corromper DOCX.
- `AI_ADAPT` precisa retornar texto limpo. `processAdaptBlock` limpa referencias indevidas e meta-comentarios.
- A injecao de equipamentos em POP depende de reconhecer a secao de materiais.

## 15. Variaveis de template

Arquivo: `lib/template-variables.ts`

Sintaxe: `{nome_da_variavel}`.

Categorias:

- Cliente.
- Responsavel tecnico.
- Listas e operacao.
- Documento.
- Legislacao.
- Recursos especiais.

Variaveis importantes:

```text
{cliente_nome_fantasia}
{cliente_nome_fantasia_upper}
{cliente_razao_social}
{cliente_razao_social_upper}
{cliente_cnpj}
{cliente_endereco}
{cliente_cidade}
{cliente_estado}
{cliente_estado_extenso}
{cliente_estado_preposicao}
{cliente_telefone}
{cliente_email}
{cliente_horario}
{cliente_logo}
{cliente_proprietario_nome}
{cliente_rt_nome}
{cliente_rt_nome_upper}
{cliente_rt_profissao}
{cliente_rt_conselho}
{cliente_rt_setor}
{cliente_rts_lista}
{cliente_rts_assinaturas}
{cliente_tem_conselho}
{cliente_tem_proprietario}
{cliente_tem_multiplos_rts}
{cliente_estrutura_fisica}
{cliente_memorial_descritivo_mbp}
{cliente_servicos_lista}
{cliente_funcionarios_lista}
{cliente_equipamentos_lista}
{cliente_produtos_insumos_lista}
{cliente_terceirizados}
{cliente_coleta_razao_social}
{cliente_coleta_cnpj}
{cliente_residuos_grupo_a}
{cliente_residuos_grupo_d}
{cliente_residuos_grupo_e}
{doc_emissao}
{doc_revisao_1ano}
{doc_revisao_2anos}
{doc_versao}
{doc_elaborador}
{doc_mes_extenso}
{doc_ano}
{documentos_a_gerar}
{texto_legislacao_federal}
{texto_legislacao_estadual}
{texto_legislacao_municipal}
```

Sintaxe especial:

```text
{#cliente_tem_conselho}...{/cliente_tem_conselho}
[AI_ADAPT_START] ... [AI_ADAPT_END]
```

## 16. Templates

Tela: `app/templates/page.tsx`

APIs:

- `GET/POST /api/templates`
- `GET/PATCH/DELETE /api/templates/[id]`
- `POST /api/templates/bulk-import`
- `GET /api/templates/[id]/preview`
- `GET /api/templates/[id]/variaveis`
- `GET/POST /api/templates/[id]/versoes`
- `POST /api/templates/[id]/versoes/[versaoId]/restaurar`
- `POST /api/templates/[id]/duplicar`

Recursos:

- Upload individual.
- Importacao em lote.
- Preview.
- Validacao de variaveis.
- Historico/restauracao de versoes.
- Duplicacao.
- `processingType` manual/automatico.

`scripts/sync-local-templates-to-supabase.js` sincroniza templates locais com Supabase/storage, mas o arquivo estava modificado localmente em 2026-06-23. Revisar antes de commitar.

## 17. Legislacoes e referencias

Tela: `app/legislacoes/page.tsx`

APIs:

- `GET/POST /api/legislacoes`
- `PATCH/DELETE /api/legislacoes/[id]`
- `POST /api/legislacoes/importar`
- `POST /api/pastas/[id]/legislacoes/associar`

Modulos:

- `lib/legislation-matcher.ts`: associa legislacoes existentes ao texto do documento de elaboracao, filtrando por BR/UF/municipio.
- `lib/reference-extractor.ts`: extrai referencias ABNT/links do DOCX e detecta as nao cadastradas.
- `lib/reference-deduplication.ts`: normaliza para evitar duplicatas por titulo/link.

Fluxo:

1. DOCX contem referencias.
2. `/api/extrair` associa as ja cadastradas e mostra referencias novas.
3. Usuario pode adicionar novas referencias a biblioteca.
4. Pasta guarda `legislacaoIds`.
5. Geracao injeta referencias selecionadas no documento.

## 18. Storage

Arquivo: `lib/file-storage.ts`.

Drivers:

- `local`: `storage/uploads`, `storage/templates`, `storage/logos`, `storage/output`.
- `supabase`: bucket `SUPABASE_STORAGE_BUCKET` (default `pasta-visa`).

Funcoes principais:

- `storageDriver`
- `saveStorageBuffer`
- `createSignedStorageUpload`
- `readStorageBuffer`
- `storageFileExists`
- `deleteGeneratedDocx`
- `materializeStorageFile`
- `saveGeneratedDocx`

Seguranca:

- Referencias Supabase usam formato `supabase://bucket/path`.
- `isManagedStorageReference` impede que rota aceite referencia fora da pasta esperada.
- Remocao de output local valida path para evitar apagar fora de `storage/output`.

## 19. Auth e middleware

Arquivos:

- `middleware.ts`
- `lib/session-auth.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`

Estado:

- Basic Auth/session temporario.
- Protege producao ate login completo.
- Variaveis: `APP_BASIC_AUTH_USER`, `APP_BASIC_AUTH_PASSWORD`.

## 20. Health/readiness

Arquivos:

- `app/api/health/route.ts`
- `lib/env-readiness.ts`
- `scripts/check-deploy-readiness.js`

`/api/health` valida configuracao sem expor segredos.

`check-deploy-readiness.js` verifica:

- Scripts obrigatorios.
- Dependencias Supabase/Postgres.
- `.gitignore`.
- Rotas API com runtime node/dinamico.
- Storage Supabase.
- Service role sem prefixo publico.
- Upload grande nao caindo em multipart na Vercel.
- Health acusando storage local em producao.

## 21. Deploy

Projeto Vercel:

- Nome observado: `pasta-visa`.
- Producoes recentes ficam em URLs `https://pasta-visa-...-estersouzas-projects.vercel.app`.

Fluxo recomendado:

```powershell
npm.cmd run build
npm.cmd run check:deploy
git add <arquivos>
git commit -m "Mensagem"
git push origin main
vercel ls
```

Ao dar push na `main`, a Vercel normalmente dispara deploy de producao automaticamente.

## 22. Problemas recentes e decisoes importantes

### PDF grande / 413 / arquivo excede tamanho

Problema ja visto:

- Anthropic pode recusar arquivo grande.
- Antes foi tentado extrair texto local do PDF e mandar `pdf_text`; isso quebrou PDFs que a Claude conseguia ler visualmente/base64.

Decisao atual:

- Em `/api/extrair`, enviar PDF sempre como `pdf_base64` document para Claude.
- Nao bloquear localmente por `pdf-parse` quando PDF nao tem texto extraivel.

### DOCX com lista grande e IA retornando zero documentos

Problema:

- A IA leu tokens, mas devolveu `documentos_a_gerar: []`.

Solucao:

- `document-list-extractor.ts` extrai documentos diretamente do texto do DOCX.
- Mescla IA + fallback.

### Dados do cliente incompletos

Problema:

- A chamada unica ficou grande demais; a IA trouxe documentos mas ignorou campos do cliente/equipamentos/insumos.

Solucao:

- Primeira chamada ainda usa PDF + DOCX.
- Se campos importantes vierem vazios, `/api/extrair` chama `extractClienteDataFromElaboracaoText`.
- Depois `client-data-fallback.ts` complementa deterministico.

### Proprietario e multiplos RTs

Campos adicionados:

- `clienteProprietarioNome`
- `clienteResponsaveisTecnicos`

Migracao:

- `prisma/migrations/20260615103000_add_owner_and_multiple_rts/migration.sql`

UI:

- `app/pasta/[id]/editar/page.tsx`

Geracao:

- `cliente_proprietario_nome`
- `cliente_rts_lista`
- `cliente_rts_assinaturas`
- `cliente_tem_proprietario`
- `cliente_tem_multiplos_rts`

### Equipamentos e insumos nos POPs

Ha suporte para selecionar equipamentos/insumos por POP na tela de processamento e injetar na secao de materiais do documento.

Arquivos:

- `app/pasta/[id]/processar/page.tsx`
- `app/api/pastas/[id]/documentos/route.ts`
- `lib/generator.ts`

### Sessao 2026-06-23 — timeout em lote grande, paralelizacao e logo

Contexto do problema: ao gerar uma pasta grande (ex: 74 docs), um documento
pesado (MBP/PGRSS/Plano de Seguranca = `SONNET_REQUIRED`) estourava o tempo da
funcao na Vercel e retornava 504. O cliente fazia `res.json()` na pagina de erro
(HTML, nao JSON), lancava `SyntaxError` e **abortava o lote inteiro** — os docs
seguintes nao eram gerados e a tela nao acusava nada.

Mudancas feitas (commits `687c97e` e `c7b88e6`):

1. Resiliencia do lote — `app/pasta/[id]/processar/page.tsx`:
   - Cada documento tem seu proprio try/catch dentro do loop; uma falha (504,
     rede, JSON invalido) marca SO aquele doc como "erro" com mensagem e o lote
     continua. Resposta lida via `res.text()` + `JSON.parse` defensivo (nao
     quebra mais em pagina de erro). Mensagem de erro aparece no tooltip do doc.
   - Pratica recomendada para pastas grandes: gerar em lotes menores (10-15).

2. Paralelizacao dos blocos de IA — `lib/generator.ts`:
   - Os blocos `[AI_ADAPT]` de UM documento agora rodam com concorrencia limitada
     (`mapWithConcurrency`, 5 por vez) em vez de um a um. Reduz muito o tempo dos
     docs pesados e evita o 504 na origem.
   - NAO afeta qualidade: os blocos sempre foram independentes (`processAdaptBlock`
     recebe so a instrucao do bloco + `clienteData`, nunca a saida de outro bloco).
     A ordem de insercao no XML e preservada. Fases: (1) enumerar blocos que pedem
     IA com as MESMAS regras de skip do loop, (2) rodar em paralelo, (3) aplicar no
     XML consumindo os resultados em ordem.

3. Cliente Anthropic com timeout/retry — `lib/ai.ts`:
   - `new Anthropic({ apiKey, timeout: 90_000, maxRetries: 2 })`. Uma chamada
     travada falha rapido e e re-tentada (429/5xx) em vez de segurar a funcao ate
     o gateway matar com 504.

4. Logo no tamanho maximo da celula — `lib/logo-replacer.ts` (`injectLogoVariable`):
   - Antes a logo injetada via `{cliente_logo}` era limitada a 1,5 cm fixo no
     cabecalho (celula real tem ~2,74 cm / 1555 twips), entao ficava pequena.
   - Agora `findLogoCellWidthTwips` le a largura real da celula que contem o
     placeholder e dimensiona a logo para preencher essa largura (inset ~8%),
     mantendo proporcao, sem upscale alem do natural, com teto de altura
     (`HEADER_MAX_HEIGHT_EMU` ~1,9 cm) pra nao crescer a linha da tabela.
   - Todos os templates usam `{cliente_logo}` (placeholder), sem imagem "baked";
     `replaceLogo`/`capHeaderLogoDimensions` praticamente nao atuam neles.

5. Cor de fundo da caixa da logo (feature nova):
   - Campo `clienteLogoBgHex` na `Pasta` (ambos schemas). Migracao
     `prisma/migrations/20260623120000_add_cliente_logo_bg_hex/` + coluna aplicada
     no Supabase de producao (`ADD COLUMN IF NOT EXISTS`).
   - UI: seletor de cor + input hex na secao "Logo do cliente" de
     `app/pasta/[id]/editar/page.tsx`. Salvo via PATCH (campo no whitelist
     `PASTA_EDIT_FIELDS` em `app/api/pastas/[id]/route.ts`).
   - `/api/gerar` passa `logoBgHex: pasta.clienteLogoBgHex` para `GeneratorOptions`.
   - `applyLogoCellBackground` (em `logo-replacer.ts`) injeta
     `<w:shd w:fill="RRGGBB">` no `<w:tcPr>` da celula da logo (apos
     `</w:tcBorders>` para respeitar a ordem do schema CT_TcPr). Identifica a
     celula pelo nome `logo_cliente` (imagem injetada) ou pelo placeholder.
   - Calibragem: se a logo ficar alta/baixa demais, ajustar `HEADER_CELL_INSET` e
     `HEADER_MAX_HEIGHT_EMU` em `injectLogoVariable`.

Importante sobre deploy/banco:
- A Vercel roda `prisma generate` (postinstall) mas NAO roda migracoes. Colunas
  novas precisam ser aplicadas no Supabase manualmente (MCP `apply_migration`,
  projeto `imywcumdngkzkeszvyxv`), senao producao da 500 no campo novo.
- Aviso de seguranca pendente: as tabelas `hotmart_vendas` e `manychat_leads`
  (mesmo projeto Supabase, nao fazem parte da PastaVISA) estao com RLS desativado.

## 23. Estado local observado em 2026-06-23

Ja commitado e publicado na `main` (commits `687c97e`, `c7b88e6`): correcoes de
geracao em lote, paralelizacao de blocos IA, timeout do cliente Anthropic, logo
preenchendo a celula, campo `clienteLogoBgHex` + UI + migracao, `PASTAVISA_CONTEXT.md`
e ignore de arquivos de cliente. Ver Secao 22 (sessao 2026-06-23).

Ainda NAO commitado (de proposito, revisar antes):

```text
 M .env.example                                  (add TEMPLATE_SOURCE_DIR)
 M scripts/sync-local-templates-to-supabase.js   (OneDrive hardcoded — ajustar antes)
```

Arquivos de cliente (`FORMS ALZIRA.pdf`, `Documentos em Elaboracao - Alzira Mesquita.docx`)
agora estao bloqueados no `.gitignore` (`/*.pdf`, `/*.docx` na raiz) — dados sensiveis,
nunca commitar.

Cuidados:

- Nao reverter alteracoes locais sem verificar se sao do usuario/outro trabalho.
- Antes de commit, usar `git diff -- <arquivos>` e stagear somente o escopo.
- O caminho fixo do OneDrive em `sync-local-templates-to-supabase.js` deve virar
  so `TEMPLATE_SOURCE_DIR` + fallback antes de commitar.

## 24. Onde mexer para tarefas comuns

### "A IA nao extraiu dados do cliente"

Ver:

- `app/api/extrair/route.ts`
- `lib/ai.ts`
- `lib/client-data-fallback.ts`
- `lib/extractor.ts`

Pontos a checar:

- PDF esta sendo enviado como base64 document?
- DOCX tem texto extraido por Mammoth?
- `needsFocusedDocxExtraction` esta acionando?
- A segunda chamada esta consumindo tokens e retornando JSON?

### "Lista de documentos veio vazia"

Ver:

- `lib/document-list-extractor.ts`
- `app/api/extrair/route.ts`
- Preview dos primeiros 600 chars e logs de `elaboracaoText.length`.

### "Template errado associado"

Ver:

- `lib/template-matcher.ts`
- `app/api/extrair/confirmar/route.ts`
- `app/api/pastas/[id]/documentos/auto-template/route.ts`

### "Documento gerado com texto ruim"

Ver:

- `lib/ai.ts`, especialmente `processAdaptBlock`, `CONTEXT_HEADER`, `DOCUMENT_VOICE_RULES`, few-shots.
- `lib/generator.ts`, blocos AI_ADAPT e variaveis.
- Tipo de processamento em `classifier.ts` e no cadastro do template.

### "DOCX corrompido"

Ver:

- `lib/generator.ts`
- `lib/text-to-ooxml.ts`
- `lib/docx-validator.ts`
- `scripts/repair-corrupted-docx.js`

### "Logo nao aparece"

Ver:

- `lib/logo-replacer.ts`
- `lib/generator.ts`
- `app/api/pastas/[id]/logo/route.ts`
- `storage/logos` ou Supabase Storage.

### "Upload grande falha na Vercel"

Ver:

- `app/api/uploads/sign/route.ts`
- `app/pasta/nova/page.tsx`
- `lib/file-storage.ts`
- `scripts/check-deploy-readiness.js`

## 25. Regras de trabalho no repo

- Usar `rg`/`rg --files` para busca.
- Usar `apply_patch` para edicoes manuais.
- Nao usar `git reset --hard` nem checkout destrutivo sem pedido explicito.
- O workspace pode estar sujo; stagear somente arquivos da tarefa.
- Rodar `npm.cmd run build` e `npm.cmd run check:deploy` antes de publicar mudancas relevantes.
- Se fizer push para `main`, conferir `vercel ls`.

## 26. Resumo rapido para outro chat

Se voce so puder ler uma parte:

- App Next.js gera pastas sanitarias com templates DOCX e IA Anthropic.
- Fluxo principal: `pasta/nova` -> `/api/extrair` -> revisao -> `/api/extrair/confirmar` -> `pasta/[id]/editar` -> `pasta/[id]/processar` -> `/api/gerar`.
- Dados extraidos sao guardados em `Pasta`; documentos em `DocumentoGerado`; templates em `Template`; referencias em `Legislacao`.
- IA esta em `lib/ai.ts`; geracao DOCX em `lib/generator.ts`.
- Storage local/Supabase em `lib/file-storage.ts`.
- Matching de templates em `lib/template-matcher.ts`.
- Fallback de lista de documentos em `lib/document-list-extractor.ts`.
- Fallback/complemento de dados do cliente em `lib/client-data-fallback.ts`.
- Nao mudar o fluxo de PDF para `pdf_text`; PDF deve ir como documento base64 para Claude.
- Antes de commitar, conferir arquivos sujos e nao incluir PDFs/DOCX de cliente.
