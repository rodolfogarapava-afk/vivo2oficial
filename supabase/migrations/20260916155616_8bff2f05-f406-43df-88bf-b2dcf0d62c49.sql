DROP POLICY IF EXISTS "Admins can update linked reseller clients" ON public.clients;
CREATE POLICY "Admins can update linked reseller clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.panel_links pl
    WHERE pl.owner_user_id = auth.uid()
      AND pl.partner_user_id = clients.user_id
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.panel_links pl
    WHERE pl.owner_user_id = auth.uid()
      AND pl.partner_user_id = clients.user_id
  )
);

DROP POLICY IF EXISTS "Admins can delete linked reseller clients" ON public.clients;
CREATE POLICY "Admins can delete linked reseller clients"
ON public.clients
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.panel_links pl
    WHERE pl.owner_user_id = auth.uid()
      AND pl.partner_user_id = clients.user_id
  )
);

ALTER FUNCTION public.update_panel_client(uuid, uuid, text, text, numeric, text, numeric, numeric) SECURITY INVOKER;
ALTER FUNCTION public.delete_panel_client(uuid, uuid) SECURITY INVOKER;