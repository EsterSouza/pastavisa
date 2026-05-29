create table if not exists public."TemplateVersao" (
  "id" text primary key,
  "templateId" text not null references public."Template"("id") on delete cascade on update cascade,
  "nome" text not null,
  "tipo" text not null,
  "padraoHeader" text not null,
  "processingType" text not null,
  "arquivoPath" text not null,
  "motivo" text,
  "criadaEm" timestamptz not null default now()
);

create index if not exists "TemplateVersao_templateId_criadaEm_idx"
  on public."TemplateVersao" ("templateId", "criadaEm");

alter table public."TemplateVersao" enable row level security;

revoke all privileges on table public."TemplateVersao"
from anon, authenticated, service_role;
