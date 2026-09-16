ALTER TABLE public.access_tokens
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'access',
  ADD COLUMN IF NOT EXISTS panel_label text;

CREATE UNIQUE INDEX IF NOT EXISTS panel_links_owner_partner_unique
  ON public.panel_links (owner_user_id, partner_user_id);

ALTER TABLE public.access_tokens
  DROP CONSTRAINT IF EXISTS access_tokens_purpose_check;

ALTER TABLE public.access_tokens
  ADD CONSTRAINT access_tokens_purpose_check
  CHECK (purpose IN ('access', 'reseller'));
