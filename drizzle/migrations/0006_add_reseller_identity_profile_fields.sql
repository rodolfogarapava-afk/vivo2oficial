ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS adhesion_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adhesion_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS adhesion_term_version text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique_idx
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length_check
  CHECK (full_name IS NULL OR char_length(full_name) BETWEEN 3 AND 120) NOT VALID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cpf_format_check
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$') NOT VALID;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    whatsapp,
    full_name,
    cpf,
    birth_date,
    adhesion_accepted,
    adhesion_accepted_at,
    adhesion_term_version
  )
  VALUES (
    new.id,
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'whatsapp', ''), '\D', '', 'g'), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g'), ''),
    CASE
      WHEN coalesce(new.raw_user_meta_data ->> 'birth_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (new.raw_user_meta_data ->> 'birth_date')::date
      ELSE NULL
    END,
    coalesce((new.raw_user_meta_data ->> 'adhesion_accepted')::boolean, false),
    CASE
      WHEN coalesce((new.raw_user_meta_data ->> 'adhesion_accepted')::boolean, false)
      THEN now()
      ELSE NULL
    END,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'adhesion_term_version', '')), '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    whatsapp = EXCLUDED.whatsapp,
    full_name = EXCLUDED.full_name,
    cpf = EXCLUDED.cpf,
    birth_date = EXCLUDED.birth_date,
    adhesion_accepted = EXCLUDED.adhesion_accepted,
    adhesion_accepted_at = EXCLUDED.adhesion_accepted_at,
    adhesion_term_version = EXCLUDED.adhesion_term_version;
  RETURN new;
END;
$function$;