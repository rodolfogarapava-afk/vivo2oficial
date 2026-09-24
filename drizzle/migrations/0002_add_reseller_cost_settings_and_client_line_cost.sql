ALTER TABLE public.panel_names
  ADD COLUMN IF NOT EXISTS fixed_expense numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_costs numeric[] NOT NULL DEFAULT '{}'::numeric[];

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS line_cost numeric;

DROP POLICY IF EXISTS "Users can insert own panel settings" ON public.panel_names;
CREATE POLICY "Users can insert own panel settings"
ON public.panel_names
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own panel settings" ON public.panel_names;
CREATE POLICY "Users can update own panel settings"
ON public.panel_names
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.add_panel_client(
  p_panel_user uuid,
  p_name text,
  p_phone text,
  p_value numeric,
  p_due_day integer DEFAULT 10,
  p_virtual_chip boolean DEFAULT false,
  p_is_resale boolean DEFAULT false,
  p_bonus boolean DEFAULT false,
  p_company text DEFAULT 'omega'::text,
  p_account integer DEFAULT NULL::integer,
  p_whatsapp text DEFAULT NULL::text,
  p_line_cost numeric DEFAULT NULL::numeric
)
RETURNS public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  saved_row public.clients;
  normalized_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  IF me IS NULL OR p_panel_user IS NULL THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  IF NOT public.has_role(me, 'admin'::public.app_role) OR NOT EXISTS (
    SELECT 1 FROM public.panel_links pl
    WHERE pl.owner_user_id = me AND pl.partner_user_id = p_panel_user
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT c.* INTO saved_row
  FROM public.clients c
  WHERE regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = normalized_phone
  LIMIT 1;

  IF saved_row.id IS NOT NULL THEN
    UPDATE public.clients
    SET user_id = p_panel_user,
        name = trim(p_name),
        phone = trim(p_phone),
        value_paid = coalesce(p_value, 0),
        due_day = coalesce(p_due_day, 10),
        virtual_chip = coalesce(p_virtual_chip, false),
        is_resale = coalesce(p_is_resale, false),
        bonus = coalesce(p_bonus, false),
        company = coalesce(p_company, 'omega'),
        account = p_account,
        whatsapp = nullif(trim(coalesce(p_whatsapp, '')), ''),
        line_cost = p_line_cost
    WHERE id = saved_row.id
    RETURNING * INTO saved_row;
  ELSE
    INSERT INTO public.clients (user_id, name, phone, value_paid, due_day, virtual_chip, is_resale, bonus, company, account, whatsapp, line_cost)
    VALUES (p_panel_user, trim(p_name), trim(p_phone), coalesce(p_value, 0), coalesce(p_due_day, 10), coalesce(p_virtual_chip, false), coalesce(p_is_resale, false), coalesce(p_bonus, false), coalesce(p_company, 'omega'), p_account, nullif(trim(coalesce(p_whatsapp, '')), ''), p_line_cost)
    RETURNING * INTO saved_row;
  END IF;

  RETURN saved_row;
END;
$function$;