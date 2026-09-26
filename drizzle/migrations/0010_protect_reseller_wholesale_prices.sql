CREATE OR REPLACE FUNCTION public.protect_reseller_line_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.panel_links pl WHERE pl.partner_user_id = NEW.user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.line_cost IS NOT NULL THEN RAISE EXCEPTION 'ONLY_ADMIN_CAN_SET_LINE_COST'; END IF;
    ELSIF NEW.line_cost IS DISTINCT FROM OLD.line_cost THEN
      RAISE EXCEPTION 'ONLY_ADMIN_CAN_SET_LINE_COST';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER protect_reseller_line_cost_trg BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.protect_reseller_line_cost();

CREATE OR REPLACE FUNCTION public.protect_reseller_default_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.panel_links pl WHERE pl.partner_user_id = NEW.user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.fixed_expense <> 0 OR cardinality(NEW.line_costs) <> 0 THEN RAISE EXCEPTION 'ONLY_ADMIN_CAN_SET_DEFAULT_COST'; END IF;
    ELSIF NEW.fixed_expense IS DISTINCT FROM OLD.fixed_expense OR NEW.line_costs IS DISTINCT FROM OLD.line_costs THEN
      RAISE EXCEPTION 'ONLY_ADMIN_CAN_SET_DEFAULT_COST';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER protect_reseller_default_cost_trg BEFORE INSERT OR UPDATE ON public.panel_names FOR EACH ROW EXECUTE FUNCTION public.protect_reseller_default_cost();