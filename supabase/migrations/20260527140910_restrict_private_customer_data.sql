-- The application reads these records only through authenticated server routes.
-- Keep customer data unavailable through the generated Supabase Data API.
alter table public."Pasta" enable row level security;
alter table public."DocumentoGerado" enable row level security;
alter table public."DocumentoVersao" enable row level security;
alter table public."Template" enable row level security;
alter table public."Legislacao" enable row level security;

revoke all privileges on table
  public."Pasta",
  public."DocumentoGerado",
  public."DocumentoVersao",
  public."Template",
  public."Legislacao"
from anon, authenticated, service_role;

-- Supabase projects may grant Data API roles access to new public objects by default.
-- Revoke those defaults so a future Prisma migration is private unless deliberately exposed.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger on tables
  from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
