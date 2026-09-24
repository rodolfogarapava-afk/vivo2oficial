CREATE OR REPLACE FUNCTION public.is_valid_cpf(value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  cpf_digits text := regexp_replace(coalesce(value, ''), '\D', '', 'g');
  total integer;
  digit integer;
  i integer;
BEGIN
  IF cpf_digits !~ '^[0-9]{11}$' OR cpf_digits ~ '^([0-9])\1{10}$' THEN
    RETURN false;
  END IF;

  total := 0;
  FOR i IN 1..9 LOOP
    total := total + substring(cpf_digits, i, 1)::integer * (11 - i);
  END LOOP;
  digit := 11 - (total % 11);
  IF digit >= 10 THEN digit := 0; END IF;
  IF digit <> substring(cpf_digits, 10, 1)::integer THEN RETURN false; END IF;

  total := 0;
  FOR i IN 1..10 LOOP
    total := total + substring(cpf_digits, i, 1)::integer * (12 - i);
  END LOOP;
  digit := 11 - (total % 11);
  IF digit >= 10 THEN digit := 0; END IF;
  RETURN digit = substring(cpf_digits, 11, 1)::integer;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_reseller_signup boolean := coalesce((new.raw_user_meta_data ->> 'reseller_signup')::boolean, false);
  clean_whatsapp text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'whatsapp', ''), '\D', '', 'g');
  clean_cpf text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g');
  submitted_name text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  submitted_birth_date date;
  accepted boolean := coalesce((new.raw_user_meta_data ->> 'adhesion_accepted')::boolean, false);
BEGIN
  IF coalesce(new.raw_user_meta_data ->> 'birth_date', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    submitted_birth_date := (new.raw_user_meta_data ->> 'birth_date')::date;
  END IF;

  IF is_reseller_signup THEN
    IF char_length(submitted_name) < 3 OR char_length(submitted_name) > 120 THEN RAISE EXCEPTION 'INVALID_FULL_NAME'; END IF;
    IF NOT public.is_valid_cpf(clean_cpf) THEN RAISE EXCEPTION 'INVALID_CPF'; END IF;
    IF char_length(clean_whatsapp) NOT IN (10, 11) THEN RAISE EXCEPTION 'INVALID_WHATSAPP'; END IF;
    IF submitted_birth_date IS NULL OR submitted_birth_date > current_date OR submitted_birth_date < current_date - interval '120 years' THEN RAISE EXCEPTION 'INVALID_BIRTH_DATE'; END IF;
    IF NOT accepted THEN RAISE EXCEPTION 'ADHESION_NOT_ACCEPTED'; END IF;
  END IF;

  INSERT INTO public.profiles (user_id, whatsapp, full_name, cpf, birth_date, adhesion_accepted, adhesion_accepted_at, adhesion_term_version)
  VALUES (
    new.id,
    nullif(clean_whatsapp, ''),
    nullif(submitted_name, ''),
    nullif(clean_cpf, ''),
    submitted_birth_date,
    accepted,
    CASE WHEN accepted THEN now() ELSE NULL END,
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