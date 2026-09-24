CREATE UNIQUE INDEX IF NOT EXISTS clients_unique_normalized_phone
ON public.clients ((regexp_replace(phone, '\D', '', 'g')))
WHERE regexp_replace(phone, '\D', '', 'g') <> '';

COMMENT ON INDEX public.clients_unique_normalized_phone IS 'Prevents the same phone line from being duplicated or assigned to two panels.';