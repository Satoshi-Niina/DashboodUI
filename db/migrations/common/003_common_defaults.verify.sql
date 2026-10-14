SELECT
  (SELECT count(*) FROM public.roles WHERE role_key IN ('system_admin', 'tenant_admin', 'manager', 'operator', 'viewer')) = 5
  AND (SELECT count(*) FROM public.app_resource_routing WHERE app_id = 'dashboard-ui' AND logical_resource_name IN ('machine_types', 'machines', 'management_offices', 'bases', 'inspection_types', 'inspection_schedules')) = 6
  AS ok;
