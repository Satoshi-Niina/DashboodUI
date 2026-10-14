CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS master_data;

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL UNIQUE,
  name varchar(255)
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(255) NOT NULL UNIQUE,
  password_hash text,
  password varchar(255),
  display_name varchar(255),
  email varchar(320),
  role varchar(100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password varchar(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name varchar(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email varchar(320);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role varchar(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.user_org_memberships (
  user_id uuid NOT NULL REFERENCES public.users(id),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key varchar(100) NOT NULL UNIQUE,
  tenant_name varchar(255) NOT NULL,
  tenant_code varchar(100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key varchar(100),
  role_name varchar(255),
  code varchar(100),
  name varchar(255)
);
ALTER TABLE public.roles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS role_key varchar(100);
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS role_name varchar(255);
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS code varchar(100);
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS name varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_roles_role_key_unique
  ON public.roles (role_key) WHERE role_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  user_id uuid NOT NULL REFERENCES public.users(id),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  role_id uuid NOT NULL REFERENCES public.roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.user_tenants (
  user_id uuid NOT NULL REFERENCES public.users(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.users(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  role_id uuid NOT NULL REFERENCES public.roles(id),
  PRIMARY KEY (user_id, tenant_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key varchar(100),
  permission_name varchar(255),
  code varchar(100),
  description text
);
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS permission_key varchar(100);
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS permission_name varchar(255);
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS code varchar(100);
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS description text;
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_permissions_key_unique
  ON public.permissions (permission_key) WHERE permission_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id),
  permission_id uuid NOT NULL REFERENCES public.permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key varchar(100) NOT NULL UNIQUE,
  app_name varchar(255) NOT NULL,
  app_url varchar(1024) NOT NULL,
  icon varchar(100),
  category varchar(100),
  display_order integer NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_db_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id),
  database_key varchar(100) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  application_id uuid NOT NULL REFERENCES public.applications(id),
  is_enabled boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT true,
  required_role varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, application_id)
);

CREATE TABLE IF NOT EXISTS public.tenant_app_routings (
  tenant_key varchar(100) NOT NULL,
  app_id varchar(100) NOT NULL,
  tenant_id varchar(100),
  tenant_name varchar(255),
  database_url text,
  database_key varchar(100),
  db_name varchar(100),
  tenant_path varchar(255),
  storage_bucket_name varchar(255),
  app_name varchar(255),
  app_url varchar(1024),
  icon varchar(100),
  icon_class varchar(100),
  category varchar(100),
  required_role varchar(100),
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  PRIMARY KEY (tenant_key, app_id)
);

CREATE TABLE IF NOT EXISTS public.app_resource_routing (
  app_id varchar(100) NOT NULL,
  logical_resource_name varchar(255) NOT NULL,
  physical_schema varchar(255) NOT NULL,
  physical_table varchar(255) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (app_id, logical_resource_name)
);
ALTER TABLE public.app_resource_routing ADD COLUMN IF NOT EXISTS app_id varchar(100);
ALTER TABLE public.app_resource_routing ADD COLUMN IF NOT EXISTS logical_resource_name varchar(255);
ALTER TABLE public.app_resource_routing ADD COLUMN IF NOT EXISTS physical_schema varchar(255);
ALTER TABLE public.app_resource_routing ADD COLUMN IF NOT EXISTS physical_table varchar(255);
ALTER TABLE public.app_resource_routing ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.app_config (
  config_key varchar(255) PRIMARY KEY,
  config_value text
);

CREATE TABLE IF NOT EXISTS master_data.app_config (
  config_key varchar(255) PRIMARY KEY,
  config_value text,
  updated_by varchar(255),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_data.app_config_history (
  id bigserial PRIMARY KEY,
  config_key varchar(255) NOT NULL,
  old_value text,
  new_value text,
  updated_by varchar(255),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_data.ai_settings (
  id bigserial PRIMARY KEY,
  app_id varchar(100) NOT NULL,
  setting_type varchar(100) NOT NULL,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, setting_type)
);

CREATE TABLE IF NOT EXISTS master_data.ai_knowledge_data (
  id bigserial PRIMARY KEY,
  title text,
  content text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_data.ai_knowledge_chunks (
  id bigserial PRIMARY KEY,
  knowledge_id bigint REFERENCES master_data.ai_knowledge_data(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
