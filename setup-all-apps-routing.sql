-- ========================================
-- 蜷・し繝悶い繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
-- emergency-client, planning, equipment, failure
-- ========================================

-- Emergency-Client・亥ｿ懈･蠕ｩ譌ｧ謾ｯ謠ｴ繧ｷ繧ｹ繝・Β・臥畑縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
-- APP_ID = 'emergency-client'

-- 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ｼ亥・騾夲ｼ・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'users', 'master_data', 'users', '繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ユ繝ｼ繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 莠区･ｭ謇繝槭せ繧ｿ・亥・騾夲ｼ・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'managements_offices', 'master_data', 'managements_offices', '莠区･ｭ謇繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ・亥・騾夲ｼ・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'bases', 'master_data', 'bases', '菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 菫晏ｮ育畑霆翫・繧ｹ繧ｿ・亥・騾夲ｼ・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'vehicles', 'master_data', 'vehicles', '菫晏ｮ育畑霆翫・繧ｹ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 讖溽ｨｮ繝槭せ繧ｿ・亥・騾夲ｼ・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'machine_types', 'master_data', 'machine_types', '讖溽ｨｮ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ・亥・騾夲ｼ・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'machines', 'master_data', 'machines', '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 蠢懈･蠕ｩ譌ｧ險倬鹸・医い繝励Μ蟆ら畑・・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'emergency_records', 'emergency', 'emergency_records', '蠢懈･蠕ｩ譌ｧ險倬鹸繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- Planning・郁ｨ育判繝ｻ螳溽ｸｾ邂｡逅・す繧ｹ繝・Β・臥畑縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
-- APP_ID = 'planning'
-- ========================================

-- 蜈ｱ騾壹・繧ｹ繧ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('planning', 'users', 'master_data', 'users', '繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ユ繝ｼ繝悶Ν・亥・騾夲ｼ・),
  ('planning', 'managements_offices', 'master_data', 'managements_offices', '莠区･ｭ謇繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('planning', 'bases', 'master_data', 'bases', '菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('planning', 'vehicles', 'master_data', 'vehicles', '菫晏ｮ育畑霆翫・繧ｹ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('planning', 'machine_types', 'master_data', 'machine_types', '讖溽ｨｮ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('planning', 'machines', 'master_data', 'machines', '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 驕玖ｻ｢險育判・医い繝励Μ蟆ら畑・・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('planning', 'schedules', 'operations', 'schedules', '驕玖ｻ｢險育判繝・・繝悶Ν'),
  ('planning', 'operation_records', 'operations', 'operation_records', '驕狗畑螳溽ｸｾ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- Equipment・井ｿ晏ｮ育畑霆顔ｮ｡逅・す繧ｹ繝・Β・臥畑縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
-- APP_ID = 'equipment'
-- ========================================

-- 蜈ｱ騾壹・繧ｹ繧ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('equipment', 'users', 'master_data', 'users', '繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ユ繝ｼ繝悶Ν・亥・騾夲ｼ・),
  ('equipment', 'managements_offices', 'master_data', 'managements_offices', '莠区･ｭ謇繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('equipment', 'bases', 'master_data', 'bases', '菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('equipment', 'vehicles', 'master_data', 'vehicles', '菫晏ｮ育畑霆翫・繧ｹ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('equipment', 'machine_types', 'master_data', 'machine_types', '讖溽ｨｮ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('equipment', 'machines', 'master_data', 'machines', '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 轤ｹ讀懆ｨ倬鹸・医い繝励Μ蟆ら畑・・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('equipment', 'inspection_records', 'inspections', 'inspection_records', '轤ｹ讀懆ｨ倬鹸繝・・繝悶Ν'),
  ('equipment', 'inspection_types', 'master_data', 'inspection_types', '轤ｹ讀懊ち繧､繝励・繧ｹ繧ｿ')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- Failure・域ｩ滓｢ｰ謨・囿邂｡逅・す繧ｹ繝・Β・臥畑縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
-- APP_ID = 'failure'
-- ========================================

-- 蜈ｱ騾壹・繧ｹ繧ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('failure', 'users', 'master_data', 'users', '繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ユ繝ｼ繝悶Ν・亥・騾夲ｼ・),
  ('failure', 'managements_offices', 'master_data', 'managements_offices', '莠区･ｭ謇繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('failure', 'bases', 'master_data', 'bases', '菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('failure', 'vehicles', 'master_data', 'vehicles', '菫晏ｮ育畑霆翫・繧ｹ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('failure', 'machine_types', 'master_data', 'machine_types', '讖溽ｨｮ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・),
  ('failure', 'machines', 'master_data', 'machines', '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 謨・囿險倬鹸・医い繝励Μ蟆ら畑・・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('failure', 'fault_records', 'maintenance', 'fault_records', '謨・囿險倬鹸繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- 讀懆ｨｼ: 蜈ｨ繧｢繝励Μ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ遒ｺ隱・
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

-- 蜈ｱ騾壹・繧ｹ繧ｿ縺ｮ蛻ｩ逕ｨ迥ｶ豕・
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

