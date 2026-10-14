BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_key varchar(100) NOT NULL UNIQUE,
  tenant_name varchar(255) NOT NULL, tenant_code varchar(100), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tenant_db_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  database_key varchar(100) NOT NULL, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id)
);
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), app_key varchar(100) NOT NULL UNIQUE,
  app_name varchar(255) NOT NULL, app_url varchar(1024) NOT NULL, icon varchar(100), category varchar(100),
  display_order integer NOT NULL DEFAULT 0, description text, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tenant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  application_id uuid NOT NULL REFERENCES public.applications(id), is_enabled boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT true, required_role varchar(100), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, application_id)
);
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username varchar(255) NOT NULL UNIQUE, password_hash text NOT NULL,
  display_name varchar(255), email varchar(320), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email varchar(320);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS public.user_tenants (
  user_id uuid NOT NULL REFERENCES public.users(id), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  is_active boolean NOT NULL DEFAULT true, PRIMARY KEY (user_id, tenant_id)
);
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_key varchar(100) NOT NULL UNIQUE, role_name varchar(255) NOT NULL
);
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS role_key varchar(100);
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS role_name varchar(255);
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS code varchar(100);
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS name varchar(255);
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.users(id), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  role_id uuid NOT NULL REFERENCES public.roles(id), PRIMARY KEY (user_id, tenant_id, role_id)
);
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), permission_key varchar(100) NOT NULL UNIQUE, permission_name varchar(255) NOT NULL
);
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS permission_key varchar(100);
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS permission_name varchar(255);
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id), permission_id uuid NOT NULL REFERENCES public.permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'code') THEN
    EXECUTE 'UPDATE public.roles SET role_key = lower(trim(code)), role_name = COALESCE(role_name, name) WHERE role_key IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'permissions' AND column_name = 'code') THEN
    EXECUTE 'UPDATE public.permissions SET permission_key = lower(trim(code)), permission_name = COALESCE(permission_name, description) WHERE permission_key IS NULL';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS roles_role_key_unique ON public.roles(role_key) WHERE role_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS permissions_permission_key_unique ON public.permissions(permission_key) WHERE permission_key IS NOT NULL;
INSERT INTO public.roles (code, name, role_key, role_name)
SELECT role_key, role_name, role_key, role_name
FROM (VALUES
  ('system_admin', 'System administrator'), ('tenant_admin', 'Tenant administrator'), ('manager', 'Manager'),
  ('operator', 'Operator'), ('viewer', 'Viewer')
) AS defaults(role_key, role_name)
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE roles.role_key = defaults.role_key);

DO $$
BEGIN
  IF to_regclass('public.tenant_app_routings') IS NULL THEN RETURN; END IF;
  INSERT INTO public.tenants (tenant_key, tenant_name, tenant_code)
  SELECT lower(trim(tenant_key)), COALESCE(NULLIF(max(tenant_name), ''), lower(trim(tenant_key))), lower(trim(tenant_key))
  FROM public.tenant_app_routings WHERE tenant_key IS NOT NULL AND trim(tenant_key) <> '' GROUP BY lower(trim(tenant_key))
  ON CONFLICT (tenant_key) DO UPDATE SET updated_at = now();
  INSERT INTO public.tenant_db_routing (tenant_id, database_key, is_active)
  SELECT id, tenant_key, true FROM public.tenants ON CONFLICT (tenant_id) DO NOTHING;
  INSERT INTO public.applications (app_key, app_name, app_url, icon, category, display_order, description, is_active)
  SELECT DISTINCT ON (lower(trim(app_id))) lower(trim(app_id)), COALESCE(NULLIF(app_name, ''), trim(app_id)),
    COALESCE(NULLIF(app_url, ''), '#'), icon, category, COALESCE(display_order, 0), description, COALESCE(is_active, true)
  FROM public.tenant_app_routings WHERE app_id IS NOT NULL AND trim(app_id) <> ''
  ORDER BY lower(trim(app_id)), display_order NULLS LAST, tenant_key
  ON CONFLICT (app_key) DO UPDATE SET app_name = EXCLUDED.app_name, app_url = EXCLUDED.app_url, icon = EXCLUDED.icon,
    category = EXCLUDED.category, display_order = EXCLUDED.display_order, description = EXCLUDED.description,
    is_active = EXCLUDED.is_active, updated_at = now();
  INSERT INTO public.tenant_applications (tenant_id, application_id, is_enabled, is_visible, required_role)
  SELECT t.id, a.id, COALESCE(r.is_active, true), COALESCE(r.is_visible, true), NULLIF(r.required_role, '')
  FROM public.tenant_app_routings r JOIN public.tenants t ON t.tenant_key = lower(trim(r.tenant_key))
  JOIN public.applications a ON a.app_key = lower(trim(r.app_id))
  ON CONFLICT (tenant_id, application_id) DO UPDATE SET is_enabled = EXCLUDED.is_enabled,
    is_visible = EXCLUDED.is_visible, required_role = EXCLUDED.required_role, updated_at = now();
END $$;

INSERT INTO public.user_tenants (user_id, tenant_id, is_active)
SELECT DISTINCT membership.user_id, tenant.id, true
FROM public.user_org_memberships membership
JOIN public.organizations organization ON organization.id = membership.org_id
JOIN public.tenants tenant ON tenant.tenant_key = lower(trim(organization.code))
ON CONFLICT (user_id, tenant_id) DO UPDATE SET is_active = true;

INSERT INTO public.user_roles (user_id, tenant_id, role_id)
SELECT DISTINCT assignment.user_id, tenant.id, assignment.role_id
FROM public.user_role_assignments assignment
JOIN public.organizations organization ON organization.id = assignment.org_id
JOIN public.tenants tenant ON tenant.tenant_key = lower(trim(organization.code))
JOIN public.roles role ON role.id = assignment.role_id AND role.role_key IS NOT NULL
ON CONFLICT (user_id, tenant_id, role_id) DO NOTHING;
COMMIT;