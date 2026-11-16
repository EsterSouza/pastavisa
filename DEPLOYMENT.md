# Deploy — infra da Treinavisa

Desde 11/11/2026 o pastavisa sai do Supabase e da Vercel e roda nas caixas da
Treinavisa. A infra (compose, DNS, banco, segredos) é do repo `infra_treinavisa`,
stack `pastavisa/`; este repo só entrega a imagem.

| peça | onde |
|---|---|
| App | Container `ghcr.io/estersouza/pastavisa:<sha>` atrás do Traefik, em `pasta.treinavisa.com.br` |
| Banco | Postgres 17, banco `pastavisa`, role `pastavisa_app` (caixa `data`) |
| Arquivos | Garage (S3), bucket `pastavisa`; referências gravadas como `s3://pastavisa/storage/<pasta>/<arquivo>` |
| Login | Keycloak `login.treinavisa.com.br`, realm `treinavisa`, client `pastavisa`, papéis `admin` e `operador` |
| Cron | Timer na caixa chama `GET /api/cron/retencao-pastas` com `Authorization: Bearer $CRON_SECRET`, todo dia às 09:00 UTC |
| Limite do planner | 10 POST a cada 5 min por IP em `/api/planejamento-comercial/{analisar,pdf}`, no Traefik (era a regra de firewall da Vercel, `scripts/planner-firewall-rules.json`) |
| Segredos | Cofre da infra, item `env_pastavisa`; nomes em `.env.example` |

## Publicar

1. Merge na `main`. O workflow `.github/workflows/imagem.yml` roda lint e
   typecheck, monta a imagem e publica no GHCR com a tag do SHA.
2. A infra troca a tag na stack `pastavisa/` e faz `docker compose pull && docker compose up -d`.
3. Conferir `https://pasta.treinavisa.com.br/api/health`: 200 com `ok: true`.
   Responde 503 e diz qual peça falta (banco, storage, login), sem mostrar valor.

## Mudança de modelo

`prisma/schema.prisma` (SQLite, desenvolvimento local) e `prisma/schema.postgres.prisma`
(produção) andam juntos. Para produção, gerar o SQL com
`npx prisma migrate diff --from-schema <antes> --to-schema prisma/schema.postgres.prisma --script`
e gravar um arquivo novo em `db/migrations/`. Quem aplica no banco é a infra,
antes de subir a imagem que depende dele.

## Desenvolvimento local

Sem `DATABASE_URL` o app usa SQLite em `prisma/dev.db`; sem `S3_ENDPOINT`, a pasta
`storage/`. O login exige o Keycloak (ou um client de teste nele) e o `SESSION_SECRET`.

## Backup local

```bash
npm run backup:local
```

Copia `prisma/dev.db`, `storage/` e um `export.json` para `backups/`.
