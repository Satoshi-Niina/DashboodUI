SELECT
  to_regclass('public.tenants') IS NOT NULL
  AND to_regclass('public.applications') IS NOT NULL
  AND to_regclass('public.tenant_db_routing') IS NOT NULL
  AND to_regclass('public.tenant_applications') IS NOT NULL
  AND to_regclass('public.app_config') IS NOT NULL
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'tenant_key')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_applications' AND column_name = 'is_enabled')
  -- 以下の削除対象テーブルは、存在する場合のみ構造チェックを実施（009で削除後はNULLを許容）
  AND (to_regclass('public.users') IS NULL OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'))
  AND (to_regclass('public.user_org_memberships') IS NULL OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_org_memberships' AND column_name = 'user_id'))
  AND (to_regclass('public.user_tenants') IS NULL OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_tenants' AND column_name = 'is_active'))
  AND (to_regclass('public.user_roles') IS NULL OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'role_id'))
  AND (to_regclass('public.app_resource_routing') IS NULL OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_resource_routing' AND column_name = 'logical_resource_name'))
  AS ok;
