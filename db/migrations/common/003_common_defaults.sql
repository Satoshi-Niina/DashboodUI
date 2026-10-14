INSERT INTO public.roles (role_key, role_name, code, name)
SELECT defaults.role_key, defaults.role_name, defaults.role_key, defaults.role_name
FROM (VALUES
  ('system_admin', 'System administrator'),
  ('tenant_admin', 'Tenant administrator'),
  ('manager', 'Manager'),
  ('operator', 'Operator'),
  ('viewer', 'Viewer')
) AS defaults(role_key, role_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles existing WHERE existing.role_key = defaults.role_key
);

INSERT INTO public.app_resource_routing
  (app_id, logical_resource_name, physical_schema, physical_table, is_active)
SELECT resource.app_id, resource.logical_resource_name, resource.physical_schema, resource.physical_table, resource.is_active
FROM (VALUES
  ('dashboard-ui', 'machine_types', 'public', 'machine_types', true),
  ('dashboard-ui', 'machines', 'public', 'machines', true),
  ('dashboard-ui', 'management_offices', 'public', 'management_offices', true),
  ('dashboard-ui', 'bases', 'public', 'bases', true),
  ('dashboard-ui', 'inspection_types', 'public', 'inspection_types', true),
  ('dashboard-ui', 'inspection_schedules', 'public', 'inspection_schedules', true)
) AS resource(app_id, logical_resource_name, physical_schema, physical_table, is_active)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.app_resource_routing existing
  WHERE existing.app_id = 'dashboard-ui'
    AND existing.logical_resource_name = resource.logical_resource_name
)
ON CONFLICT DO NOTHING;
