-- Integration records are server-only. Keep browser roles outside the Data API surface.
revoke all privileges on table
  public.hotmart_vendas,
  public.manychat_leads
from anon, authenticated;

alter table public.hotmart_vendas enable row level security;
alter table public.manychat_leads enable row level security;

-- Trusted integrations continue to use the server-side service role.
grant all privileges on table
  public.hotmart_vendas,
  public.manychat_leads
to service_role;
