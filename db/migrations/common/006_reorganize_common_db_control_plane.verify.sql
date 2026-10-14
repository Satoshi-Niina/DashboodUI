SELECT
  to_regclass('public.app_config') IS NOT NULL
  AND to_regclass('public.tenant_db_routing') IS NOT NULL
  AND to_regclass('public.tenant_applications') IS NOT NULL
  AND to_regclass('public.applications') IS NOT NULL
  AND to_regclass('public.tenants') IS NOT NULL
  AND to_regclass('public.tenant_public_ids') IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.app_config WHERE config_key = 'auth_mode')
  AS ok;
