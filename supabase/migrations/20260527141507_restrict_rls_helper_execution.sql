-- Event-trigger helper: it may run internally, but it is not an application RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role;
