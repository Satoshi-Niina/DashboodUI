SELECT
  to_regclass('master_data.app_config') IS NOT NULL
  AND to_regclass('public.users') IS NOT NULL
  AND to_regclass('public.user_org_memberships') IS NOT NULL
  AND to_regclass('public.user_role_assignments') IS NOT NULL
  AND to_regclass('master_data.machines') IS NOT NULL
  AND to_regclass('master_data.bases') IS NOT NULL
  AND to_regclass('operations.inspection_records') IS NOT NULL
  AND to_regclass('operations.inspection_runs') IS NOT NULL
  AS ok;
