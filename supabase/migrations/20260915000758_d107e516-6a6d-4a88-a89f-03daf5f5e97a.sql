CREATE OR REPLACE FUNCTION public.list_panel_clients(p_panel_user uuid)
RETURNS TABLE(
  id uuid,
  name text,
  phone text,
  value_paid numeric,
  blocked boolean,
  due_day integer,
  data_gb numeric,
  data_used_gb numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL OR p_panel_user IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.panel_links pl
    WHERE (pl.owner_user_id = me AND pl.partner_user_id = p_panel_user)
       OR (pl.partner_user_id = me AND pl.owner_user_id = p_panel_user)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.phone, c.value_paid, c.blocked, c.due_day, c.data_gb, c.data_used_gb
  FROM public.clients c
  WHERE c.user_id = p_panel_user
  ORDER BY c.name;
END;
$$;