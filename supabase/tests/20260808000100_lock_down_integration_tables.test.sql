begin;

do $test$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.hotmart_vendas'::regclass) then
    raise exception 'hotmart_vendas must have RLS enabled';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.manychat_leads'::regclass) then
    raise exception 'manychat_leads must have RLS enabled';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('hotmart_vendas', 'manychat_leads')
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'browser roles must not have integration-table privileges';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('hotmart_vendas', 'manychat_leads')
  ) then
    raise exception 'integration tables must not have public policies';
  end if;

  if not (
    select bool_and(has_table_privilege('service_role', table_name, privilege))
    from unnest(array[
      'public.hotmart_vendas',
      'public.manychat_leads'
    ]) as tables(table_name)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privileges(privilege)
  ) then
    raise exception 'service_role must keep CRUD access to integration tables';
  end if;

  if not (select rolbypassrls from pg_roles where rolname = 'service_role') then
    raise exception 'service_role must bypass RLS for trusted integrations';
  end if;
end
$test$;

rollback;
