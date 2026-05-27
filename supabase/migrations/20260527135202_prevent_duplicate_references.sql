alter table "Legislacao" add column if not exists "chaveReferencia" text;

create unique index if not exists "Legislacao_chaveReferencia_key"
  on "Legislacao" ("chaveReferencia")
  where "chaveReferencia" is not null;
