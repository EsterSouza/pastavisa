create table if not exists "DocumentoVersao" (
  "id" text primary key,
  "documentoId" text not null references "DocumentoGerado"("id") on delete cascade on update cascade,
  "outputPath" text not null,
  "tokensUsados" integer,
  "avisoRtNoCorpo" boolean not null default false,
  "logoSubstituida" boolean not null default false,
  "criadaEm" timestamptz not null default now()
);

create index if not exists "DocumentoVersao_documentoId_criadaEm_idx"
  on "DocumentoVersao" ("documentoId", "criadaEm");

alter table "DocumentoVersao" enable row level security;
