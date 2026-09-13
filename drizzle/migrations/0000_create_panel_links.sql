CREATE TABLE public.panel_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  partner_user_id uuid NOT NULL,
  partner_label text NOT NULL DEFAULT 'CHIP NET',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, partner_user_id)
);

GRANT SELECT, INSERT, DELETE ON public.panel_links TO authenticated;
GRANT ALL ON public.panel_links TO service_role;

ALTER TABLE public.panel_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Panel links: participants can read"
ON public.panel_links FOR SELECT TO authenticated
USING (auth.uid() = owner_user_id OR auth.uid() = partner_user_id);

CREATE POLICY "Panel links: partner can create own link"
ON public.panel_links FOR INSERT TO authenticated
WITH CHECK (auth.uid() = partner_user_id);

CREATE POLICY "Panel links: participants can delete"
ON public.panel_links FOR DELETE TO authenticated
USING (auth.uid() = owner_user_id OR auth.uid() = partner_user_id);

CREATE OR REPLACE FUNCTION public.find_phone_across_panels(p_phone text)
RETURNS TABLE(client_name text, client_phone text, panel text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  IF me IS NULL OR length(digits) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.name,
         c.phone,
         CASE
           WHEN c.user_id = me THEN 'MEU PAINEL'
           WHEN pl.owner_user_id = c.user_id THEN 'PAINEL PRINCIPAL'
           ELSE pl.partner_label
         END
  FROM public.clients c
  LEFT JOIN public.panel_links pl
    ON (pl.owner_user_id = me AND pl.partner_user_id = c.user_id)
    OR (pl.partner_user_id = me AND pl.owner_user_id = c.user_id)
  WHERE regexp_replace(c.phone, '\D', '', 'g') LIKE '%' || digits || '%'
    AND (c.user_id = me OR pl.id IS NOT NULL)
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_phone_across_panels(text) TO authenticated;