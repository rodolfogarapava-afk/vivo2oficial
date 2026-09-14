REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;