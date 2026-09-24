DROP FUNCTION IF EXISTS public.add_panel_client(uuid, text, text, numeric, integer, boolean, boolean, boolean, text, integer, text);

CREATE OR REPLACE FUNCTION public.update_panel_client(
  p_panel_user uuid,
  p_client_id uuid,
  p_name text,
  p_phone text,
  p_value numeric,
  p_whatsapp text DEFAULT NULL::text,
  p_data_gb numeric DEFAULT 0,
  p_data_used_gb numeric DEFAULT 0,
  p_line_cost numeric DEFAULT NULL::numeric
)
RETURNS public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  updated_row public.clients;
BEGIN
  IF me IS NULL OR p_panel_user IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  IF NOT public.has_role(me, 'admin'::public.app_role) OR NOT EXISTS (
    SELECT 1 FROM public.panel_links pl
    WHERE pl.owner_user_id = me AND pl.partner_user_id = p_panel_user
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  UPDATE public.clients
  SET name = trim(p_name),
      phone = trim(p_phone),
      value_paid = coalesce(p_value, 0),
      whatsapp = nullif(trim(coalesce(p_whatsapp, '')), ''),
      data_gb = greatest(coalesce(p_data_gb, 0), 0),
      data_used_gb = greatest(coalesce(p_data_used_gb, 0), 0),
      line_cost = p_line_cost
  WHERE id = p_client_id
    AND user_id = p_panel_user
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'CLIENT_NOT_FOUND';
  END IF;

  RETURN updated_row;
END;
$function$;