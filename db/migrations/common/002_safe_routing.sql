ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS database_key varchar(100);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS db_name varchar(100);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS database_url text;
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS tenant_key varchar(100);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS app_id varchar(100);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS tenant_path varchar(255);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS tenant_name varchar(255);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS storage_bucket_name varchar(255);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS app_name varchar(255);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS app_url varchar(1024);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS icon varchar(100);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS icon_class varchar(100);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS category varchar(100);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS required_role varchar(100);
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.tenant_app_routings ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.tenant_app_routings ALTER COLUMN database_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS dashboard_tenant_routes_active_idx
  ON public.tenant_app_routings (tenant_key, is_active);
