CREATE OR REPLACE FUNCTION public.add_panel_client(
  p_panel_user uuid,
  p_name text,
  p_phone text,
  p_value numeric,
  p_due_day integer DEFAULT 10,
  p_virtual_chip boolean DEFAULT false,
  p_is_resale boolean DEFAULT false,
  p_bonus boolean DEFAULT false,
  p_company text DEFAULT 'omega',
  p_account integer DEFAULT NULL,
  p_whatsapp text DEFAULT NULL
)
RETURNS public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  new_row public.clients;
BEGIN
  IF me IS NULL OR p_panel_user IS NULL THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.panel_links pl
    WHERE (pl.owner_user_id = me AND pl.partner_user_id = p_panel_user)
       OR (pl.partner_user_id = me AND pl.owner_user_id = p_panel_user)
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  INSERT INTO public.clients (user_id, name, phone, value_paid, due_day, virtual_chip, is_resale, bonus, company, account, whatsapp)
  VALUES (p_panel_user, p_name, p_phone, coalesce(p_value, 0), coalesce(p_due_day, 10), coalesce(p_virtual_chip, false), coalesce(p_is_resale, false), coalesce(p_bonus, false), coalesce(p_company, 'omega'), p_account, p_whatsapp)
  RETURNING * INTO new_row;

  RETURN new_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_panel_client(uuid, text, text, numeric, integer, boolean, boolean, boolean, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_panel_client(uuid, text, text, numeric, integer, boolean, boolean, boolean, text, integer, text) TO authenticated, service_role;