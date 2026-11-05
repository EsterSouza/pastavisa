-- Páginas dos PDFs de cada pasta (card "Páginas da pasta" e tela Impressões).
-- Sem chave estrangeira para Pasta: a pasta é excluída 30 dias depois de
-- concluída e o histórico de impressão fica.
create table if not exists public."ContagemPaginas" (
  "id" text primary key,
  "pastaId" text unique,
  "cliente" text not null,
  "versao" text,
  "paginas" integer not null,
  "documentos" text not null,
  "contadaEm" timestamptz not null default now()
);

create index if not exists "ContagemPaginas_contadaEm_idx"
  on public."ContagemPaginas" ("contadaEm");

alter table public."ContagemPaginas" enable row level security;

revoke all privileges on table public."ContagemPaginas"
from anon, authenticated, service_role;
