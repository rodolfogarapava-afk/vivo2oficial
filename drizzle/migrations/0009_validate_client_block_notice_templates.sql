ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_whatsapp_block_notice_length
  CHECK (whatsapp_block_notice IS NULL OR char_length(whatsapp_block_notice) BETWEEN 1 AND 4000) NOT VALID,
  ADD CONSTRAINT profiles_whatsapp_unblock_notice_length
  CHECK (whatsapp_unblock_notice IS NULL OR char_length(whatsapp_unblock_notice) BETWEEN 1 AND 4000) NOT VALID;