-- roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

INSERT INTO public.user_roles (user_id, role)
VALUES ('a4326bcb-bf49-4bf2-a306-3c6064a5c967', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- access tokens
CREATE TABLE IF NOT EXISTS public.access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT '30d',
  created_by uuid,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_tokens TO authenticated;
GRANT ALL ON public.access_tokens TO service_role;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage access tokens" ON public.access_tokens;
CREATE POLICY "Admins manage access tokens"
ON public.access_tokens FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_access_tokens_updated_at ON public.access_tokens;
CREATE TRIGGER update_access_tokens_updated_at
BEFORE UPDATE ON public.access_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- profile access fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_plan text,
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;

-- panel names
CREATE TABLE IF NOT EXISTS public.panel_names (
  user_id uuid PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.panel_names TO authenticated;
GRANT ALL ON public.panel_names TO service_role;
ALTER TABLE public.panel_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone signed in can read panel names" ON public.panel_names;
CREATE POLICY "Anyone signed in can read panel names"
ON public.panel_names FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins write panel names" ON public.panel_names;
CREATE POLICY "Admins write panel names"
ON public.panel_names FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_panel_names_updated_at ON public.panel_names;
CREATE TRIGGER update_panel_names_updated_at
BEFORE UPDATE ON public.panel_names
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.panel_names (user_id, label)
VALUES ('a4326bcb-bf49-4bf2-a306-3c6064a5c967', 'RAIO TELECOM')
ON CONFLICT (user_id) DO NOTHING;