-- Datas e versão da pasta lidas do "Documentos em Elaboração" (lib/elaboracao-prazos.ts).
-- As pastas antigas são preenchidas pela própria lista de pastas, que relê o documento
-- de cada uma que ainda não tem "prazosLidosEm".
alter table public."Pasta" add column if not exists "inicioProjeto" timestamptz;
alter table public."Pasta" add column if not exists "apreciacaoInicio" timestamptz;
alter table public."Pasta" add column if not exists "apreciacaoFim" timestamptz;
alter table public."Pasta" add column if not exists "entregaFinal" timestamptz;
alter table public."Pasta" add column if not exists "versaoPasta" text;
alter table public."Pasta" add column if not exists "prazosLidosEm" timestamptz;
