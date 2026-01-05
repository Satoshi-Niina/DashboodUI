-- ========================================
-- Dashboard UI逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
-- APP_ID = 'dashboard-ui'
-- ========================================

-- 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ｼ亥・騾夲ｼ・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'users', 'master_data', 'users', '繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ユ繝ｼ繝悶Ν・亥・騾夲ｼ・)
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
  ('dashboard-ui', 'managements_offices', 'master_data', 'managements_offices', '莠区･ｭ謇繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
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
  ('dashboard-ui', 'bases', 'master_data', 'bases', '菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
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
  ('dashboard-ui', 'vehicles', 'master_data', 'vehicles', '菫晏ｮ育畑霆翫・繧ｹ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
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
  ('dashboard-ui', 'machine_types', 'master_data', 'machine_types', '讖溽ｨｮ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
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
  ('dashboard-ui', 'machines', 'master_data', 'machines', '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝・・繝悶Ν・亥・騾夲ｼ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- 遒ｺ隱・ Dashboard UI縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ遒ｺ隱・
-- ========================================
SELECT 
  app_id,
  logical_resource_name,
  physical_schema,
  physical_table,
  is_active,
  created_at,
  updated_at
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;
