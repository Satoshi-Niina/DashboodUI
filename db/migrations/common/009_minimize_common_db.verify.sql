-- Verification for 009_minimize_common_db
SELECT
  -- 削除対象テーブルが存在しないこと
  to_regclass('public.role_permissions') IS NULL
  AND to_regclass('public.user_role_assignments') IS NULL
  AND to_regclass('public.user_roles') IS NULL
  AND to_regclass('public.deprecated_user_roles') IS NULL
  AND to_regclass('public.user_org_memberships') IS NULL
  AND to_regclass('public.user_tenants') IS NULL
  AND to_regclass('public.sites') IS NULL
  AND to_regclass('public.permissions') IS NULL
  AND to_regclass('public.roles') IS NULL
  AND to_regclass('public.users') IS NULL
  AND to_regclass('public.organizations') IS NULL
  AND to_regclass('public.app_resource_routing') IS NULL
  AND to_regclass('public.tenant_app_routings') IS NULL
  AND to_regclass('public.company_db_routing') IS NULL
  AND to_regclass('master_data.company_db_routing') IS NULL
  AND to_regclass('master_data.users') IS NULL
  AND to_regclass('master_data.app_config_history') IS NULL
  AND to_regclass('master_data.app_config') IS NULL
  -- コントロールプレーン保持対象テーブルが健全に存在すること
  AND to_regclass('public.tenants') IS NOT NULL
  AND to_regclass('public.tenant_public_ids') IS NOT NULL
  AND to_regclass('public.tenant_db_routing') IS NOT NULL
  AND to_regclass('public.applications') IS NOT NULL
  AND to_regclass('public.tenant_applications') IS NOT NULL
  AND to_regclass('public.devices') IS NOT NULL
  AND to_regclass('public.device_certificates') IS NOT NULL
  AND to_regclass('public.app_config') IS NOT NULL
  AND to_regclass('public.dashboard_schema_migrations') IS NOT NULL
  -- 要確認テーブルが保持されていること
  AND to_regclass('master_data.ai_settings') IS NOT NULL
  AND to_regclass('master_data.ai_knowledge_data') IS NOT NULL
  AND to_regclass('master_data.ai_knowledge_chunks') IS NOT NULL
  AS ok;
