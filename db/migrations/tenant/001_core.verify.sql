SELECT
  to_regclass('public.users') IS NOT NULL
  AND to_regclass('public.management_offices') IS NOT NULL
  AND to_regclass('public.machine_types') IS NOT NULL
  AND to_regclass('public.machines') IS NOT NULL
  AND to_regclass('public.bases') IS NOT NULL
  AND to_regclass('public.inspection_types') IS NOT NULL
  AND to_regclass('public.inspection_schedules') IS NOT NULL
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role')
  AND to_regclass('master_data.app_config') IS NOT NULL
  AND to_regclass('master_data.app_config_history') IS NOT NULL
  AND to_regclass('master_data.ai_settings') IS NOT NULL
  AND to_regclass('master_data.ai_knowledge_data') IS NOT NULL
  AND to_regclass('master_data.ai_knowledge_chunks') IS NOT NULL
  AS ok;
