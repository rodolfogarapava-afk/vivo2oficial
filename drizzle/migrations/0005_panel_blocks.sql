CREATE TABLE public.panel_blocks (
  user_id uuid PRIMARY KEY,
  blocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.panel_blocks TO authenticated;
GRANT ALL ON public.panel_blocks TO service_role;
ALTER TABLE public.panel_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage panel blocks" ON public.panel_blocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users see own block" ON public.panel_blocks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_panel_blocked(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.panel_blocks WHERE user_id = _user_id)
$$;

CREATE POLICY "Blocked users have no client access" ON public.clients AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_panel_blocked(auth.uid())) WITH CHECK (NOT public.is_panel_blocked(auth.uid()));
CREATE POLICY "Blocked users have no payment access" ON public.client_payments AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_panel_blocked(auth.uid())) WITH CHECK (NOT public.is_panel_blocked(auth.uid()));