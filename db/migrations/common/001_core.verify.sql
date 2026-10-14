SELECT
  to_regclass('public.organizations') IS NOT NULL
  AND to_regclass('public.users') IS NOT NULL
  AND to_regclass('public.user_org_memberships') IS NOT NULL
  AND to_regclass('public.tenants') IS NOT NULL
  AND to_regclass('public.roles') IS NOT NULL
  AND to_regclass('public.user_role_assignments') IS NOT NULL
  AND to_regclass('public.user_tenants') IS NOT NULL
  AND to_regclass('public.user_roles') IS NOT NULL
  AND to_regclass('public.permissions') IS NOT NULL
  AND to_regclass('public.role_permissions') IS NOT NULL
  AND to_regclass('public.applications') IS NOT NULL
  AND to_regclass('public.tenant_db_routing') IS NOT NULL
  AND to_regclass('public.tenant_applications') IS NOT NULL
  AND to_regclass('public.tenant_app_routings') IS NOT NULL
  AND to_regclass('public.app_resource_routing') IS NOT NULL
  AND to_regclass('public.app_config') IS NOT NULL
  AND to_regclass('master_data.app_config') IS NOT NULL
  AND to_regclass('master_data.app_config_history') IS NOT NULL
  AND to_regclass('master_data.ai_settings') IS NOT NULL
  AND to_regclass('master_data.ai_knowledge_data') IS NOT NULL
  AND to_regclass('master_data.ai_knowledge_chunks') IS NOT NULL
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_org_memberships' AND column_name = 'user_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_org_memberships' AND column_name = 'org_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'tenant_key')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_tenants' AND column_name = 'is_active')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'role_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_applications' AND column_name = 'is_enabled')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_resource_routing' AND column_name = 'logical_resource_name')
  AS ok;
