ALTER TABLE public.panel_names
ADD COLUMN IF NOT EXISTS support_whatsapp text;

COMMENT ON COLUMN public.panel_names.support_whatsapp IS 'WhatsApp do administrador usado pelos revendedores para solicitar suporte.';