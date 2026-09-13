REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE ALL ON FUNCTION public.find_phone_across_panels(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_phone_across_panels(text) TO authenticated, service_role;