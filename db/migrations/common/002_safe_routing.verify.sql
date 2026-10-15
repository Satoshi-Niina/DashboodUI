SELECT
  (to_regclass('public.tenant_app_routings') IS NULL
   OR (
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_app_routings' AND column_name = 'database_key')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_app_routings' AND column_name = 'db_name')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_app_routings' AND column_name = 'app_url')
   ))
  AS ok;
