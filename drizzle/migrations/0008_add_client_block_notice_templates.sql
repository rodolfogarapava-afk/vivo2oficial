ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_block_notice text,
  ADD COLUMN IF NOT EXISTS whatsapp_unblock_notice text;

COMMENT ON COLUMN public.profiles.whatsapp_block_notice IS 'Mensagem personalizada enviada ao cliente quando a linha é bloqueada.';
COMMENT ON COLUMN public.profiles.whatsapp_unblock_notice IS 'Mensagem personalizada enviada ao cliente quando a linha é desbloqueada.';