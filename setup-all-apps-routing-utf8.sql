-- ========================================
-- All Applications Routing Setup
-- emergency-client, planning, equipment, failure
-- ========================================

-- Emergency-Client Routing
-- APP_ID = 'emergency-client'

INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('emergency-client', 'users', 'master_data', 'users'),
  ('emergency-client', 'managements_offices', 'master_data', 'managements_offices'),
  ('emergency-client', 'bases', 'master_data', 'bases'),
  ('emergency-client', 'vehicles', 'master_data', 'vehicles'),
  ('emergency-client', 'machine_types', 'master_data', 'machine_types'),
  ('emergency-client', 'machines', 'master_data', 'machines')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true;

INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('emergency-client', 'emergency_records', 'emergency', 'emergency_records')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true;

-- ========================================
-- Planning Routing
-- APP_ID = 'planning'
-- ========================================

INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('planning', 'users', 'master_data', 'users'),
  ('planning', 'managements_offices', 'master_data', 'managements_offices'),
  ('planning', 'bases', 'master_data', 'bases'),
  ('planning', 'vehicles', 'master_data', 'vehicles'),
  ('planning', 'machine_types', 'master_data', 'machine_types'),
  ('planning', 'machines', 'master_data', 'machines')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true;

INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('planning', 'schedules', 'operations', 'schedules'),
  ('planning', 'operation_records', 'operations', 'operation_records')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true;

-- ========================================
-- Equipment Routing
-- APP_ID = 'equipment'
-- ========================================

INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('equipment', 'users', 'master_data', 'users'),
  ('equipment', 'managements_offices', 'master_data', 'managements_offices'),
  ('equipment', 'bases', 'master_data', 'bases'),
  ('equipment', 'vehicles', 'master_data', 'vehicles'),
  ('equipment', 'machine_types', 'master_data', 'machine_types'),
  ('equipment', 'machines', 'master_data', 'machines')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true;

INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('equipment', 'inspection_records', 'inspections', 'inspection_records'),
  ('equipment', 'inspection_types', 'master_data', 'inspection_types')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true;

-- ========================================
-- Failure Routing
-- APP_ID = 'failure'
-- ========================================

INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('failure', 'users', 'master_data', 'users'),
  ('failure', 'managements_offices', 'master_data', 'managements_offices'),
  ('failure', 'bases', 'master_data', 'bases'),
  ('failure', 'vehicles', 'master_data', 'vehicles'),
  ('failure', 'machine_types', 'master_data', 'machine_types'),
  ('failure', 'machines', 'master_data', 'machines')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true;

INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('failure', 'fault_records', 'maintenance', 'fault_records')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true;

-- ========================================
-- Verification: All Applications Routing Status
-- ========================================

SELECT 
    app_id,
    COUNT(*) as total_routes,
    COUNT(*) FILTER (WHERE is_active = true) as active_routes,
    STRING_AGG(logical_resource_name, ', ' ORDER BY logical_resource_name) as resources
FROM public.app_resource_routing
WHERE app_id IN ('dashboard-ui', 'emergency-client', 'planning', 'equipment', 'failure')
GROUP BY app_id
ORDER BY app_id;

-- Shared Master Tables Usage Status
SELECT 
    logical_resource_name,
    physical_schema || '.' || physical_table as full_path,
    STRING_AGG(app_id, ', ' ORDER BY app_id) as used_by_apps,
    COUNT(*) as app_count
FROM public.app_resource_routing
WHERE logical_resource_name IN ('users', 'managements_offices', 'bases', 'vehicles', 'machine_types', 'machines')
  AND is_active = true
GROUP BY logical_resource_name, physical_schema, physical_table
ORDER BY logical_resource_name;
