REVOKE EXECUTE ON FUNCTION public.list_panel_clients(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_panel_clients(uuid) TO authenticated, service_role;