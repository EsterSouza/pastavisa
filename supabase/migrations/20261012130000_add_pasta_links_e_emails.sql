-- Links da pasta (Drive e OneDrive) e registro dos e-mails enviados à cliente (lib/emails).
alter table public."Pasta" add column if not exists "linkDrive" text;
alter table public."Pasta" add column if not exists "linkOneDrive" text;
alter table public."Pasta" add column if not exists "senhaOneDrive" text;

create table if not exists public."EmailEnviado" (
  "id" text primary key,
  "pastaId" text not null references public."Pasta"("id") on delete cascade on update cascade,
  "tipo" text not null,
  "para" text not null,
  "assunto" text not null,
  "enviadoEm" timestamptz not null default now()
);

create index if not exists "EmailEnviado_pastaId_enviadoEm_idx"
  on public."EmailEnviado" ("pastaId", "enviadoEm");

alter table public."EmailEnviado" enable row level security;

revoke all privileges on table public."EmailEnviado"
from anon, authenticated, service_role;
