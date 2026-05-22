# Deploy Vercel + Supabase

## Readiness check

Antes de publicar, rode:

```powershell
npm.cmd run check:deploy
npm.cmd run build
```

Depois do deploy, confira:

```text
https://your-domain.vercel.app/api/health
```

Esse endpoint valida banco, storage e variaveis sem expor segredos.

## Backup local

Antes de qualquer migracao:

```powershell
npm.cmd run backup:local
```

O backup copia `prisma/dev.db`, `storage/` e um `export.json` para `backups/`.

## Supabase

Usaremos Supabase para:

- Postgres: dados das pastas, templates, documentos e legislacao.
- Storage: logos, PDFs, templates e DOCX gerados.
- Auth/RLS: proxima etapa, quando sairmos do Basic Auth temporario.

Variaveis necessarias:

```env
DATABASE_URL=
FILE_STORAGE_DRIVER=supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=pasta-visa
```

`SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para codigo de cliente nem receber prefixo `NEXT_PUBLIC_`.

## Migracao de dados

1. Rode backup local.
2. Preencha as variaveis Supabase em `.env.local`.
3. Migre as tabelas do SQLite local para o Postgres:

```powershell
npm.cmd run migrate:local-to-supabase
```

4. Migre arquivos locais para o Supabase Storage e atualize as referencias no Postgres:

```powershell
npm.cmd run migrate:storage-to-supabase
```

Os scripts sao idempotentes por `id`, entao podem ser reexecutados se uma etapa falhar.

## Vercel env checklist

Configure em Production e Preview:

```env
ANTHROPIC_API_KEY=
DATABASE_URL=
FILE_STORAGE_DRIVER=supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=pasta-visa
APP_BASIC_AUTH_USER=
APP_BASIC_AUTH_PASSWORD=
```

## Ordem de publicacao

1. `npm.cmd run backup:local`
2. Criar projeto Supabase e bucket `pasta-visa`.
3. Preencher `.env.local` com as variaveis Supabase.
4. `npm.cmd run migrate:local-to-supabase`
5. `npm.cmd run migrate:storage-to-supabase`
6. Trocar o Prisma ativo de SQLite para Postgres quando `DATABASE_URL` estiver validada.
7. `npm.cmd run check:deploy`
8. `npm.cmd run build`
9. Deploy na Vercel.
10. Abrir `/api/health`.

## Estado atual

- Projeto Vercel localmente vinculado: `pasta-visa`.
- Storage Supabase: arquitetura pronta no codigo, aguardando credenciais.
- Banco Supabase/Postgres: scripts de criacao/migracao prontos, aguardando `DATABASE_URL`.
- Basic Auth: continua como protecao temporaria ate implementarmos login completo.
