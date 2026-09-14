ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fixed_expense numeric,
  ADD COLUMN IF NOT EXISTS whatsapp_show_card boolean,
  ADD COLUMN IF NOT EXISTS whatsapp_client_message text;