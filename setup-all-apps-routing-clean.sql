-- ========================================
-- 陷ｷ繝ｻ縺礼ｹ晄じ縺・ｹ晏干ﾎ懃ｹｧ・ｱ郢晢ｽｼ郢ｧ・ｷ郢晢ｽｧ郢晢ｽｳ騾包ｽｨ邵ｺ・ｮ郢晢ｽｫ郢晢ｽｼ郢昴・縺・ｹ晢ｽｳ郢ｧ・ｰ髫ｪ・ｭ陞ｳ繝ｻ
-- emergency-client, planning, equipment, failure
-- ========================================

-- Emergency-Client繝ｻ莠･・ｿ諛按・･陟包ｽｩ隴鯉ｽｧ隰ｾ・ｯ隰・ｴ郢ｧ・ｷ郢ｧ・ｹ郢昴・ﾎ偵・閾･逡醍ｸｺ・ｮ郢晢ｽｫ郢晢ｽｼ郢昴・縺・ｹ晢ｽｳ郢ｧ・ｰ髫ｪ・ｭ陞ｳ繝ｻ
-- APP_ID = 'emergency-client'

-- 郢晢ｽｦ郢晢ｽｼ郢ｧ・ｶ郢晢ｽｼ驍ゑｽ｡騾・・・ｼ莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'users', 'master_data', 'users', '郢晢ｽｦ郢晢ｽｼ郢ｧ・ｶ郢晢ｽｼ驍ゑｽ｡騾・・繝ｦ郢晢ｽｼ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 闔蛹ｺ・･・ｭ隰・郢晄ｧｭ縺帷ｹｧ・ｿ繝ｻ莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'managements_offices', 'master_data', 'managements_offices', '闔蛹ｺ・･・ｭ隰・郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 闖ｫ譎擾ｽｮ莠･貂戊舉・ｰ郢晄ｧｭ縺帷ｹｧ・ｿ繝ｻ莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'bases', 'master_data', 'bases', '闖ｫ譎擾ｽｮ莠･貂戊舉・ｰ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 闖ｫ譎擾ｽｮ閧ｲ逡鷹怕鄙ｫ繝ｻ郢ｧ・ｹ郢ｧ・ｿ繝ｻ莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'vehicles', 'master_data', 'vehicles', '闖ｫ譎擾ｽｮ閧ｲ逡鷹怕鄙ｫ繝ｻ郢ｧ・ｹ郢ｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 隶匁ｺｽ・ｨ・ｮ郢晄ｧｭ縺帷ｹｧ・ｿ繝ｻ莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'machine_types', 'master_data', 'machine_types', '隶匁ｺｽ・ｨ・ｮ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 隶匁ｻ難ｽ｢・ｰ騾｡・ｪ陷ｿ・ｷ郢晄ｧｭ縺帷ｹｧ・ｿ繝ｻ莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'machines', 'master_data', 'machines', '隶匁ｻ難ｽ｢・ｰ騾｡・ｪ陷ｿ・ｷ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 陟｢諛按・･陟包ｽｩ隴鯉ｽｧ髫ｪ蛟ｬ鮖ｸ繝ｻ蛹ｻ縺・ｹ晏干ﾎ懆氣繧臥舞繝ｻ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('emergency-client', 'emergency_records', 'emergency', 'emergency_records', '陟｢諛按・･陟包ｽｩ隴鯉ｽｧ髫ｪ蛟ｬ鮖ｸ郢昴・繝ｻ郢晄じﾎ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- Planning繝ｻ驛・ｽｨ閧ｲ蛻､郢晢ｽｻ陞ｳ貅ｽ・ｸ・ｾ驍ゑｽ｡騾・・縺咏ｹｧ・ｹ郢昴・ﾎ偵・閾･逡醍ｸｺ・ｮ郢晢ｽｫ郢晢ｽｼ郢昴・縺・ｹ晢ｽｳ郢ｧ・ｰ髫ｪ・ｭ陞ｳ繝ｻ
-- APP_ID = 'planning'
-- ========================================

-- 陷茨ｽｱ鬨ｾ螢ｹ繝ｻ郢ｧ・ｹ郢ｧ・ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('planning', 'users', 'master_data', 'users', '郢晢ｽｦ郢晢ｽｼ郢ｧ・ｶ郢晢ｽｼ驍ゑｽ｡騾・・繝ｦ郢晢ｽｼ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('planning', 'managements_offices', 'master_data', 'managements_offices', '闔蛹ｺ・･・ｭ隰・郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('planning', 'bases', 'master_data', 'bases', '闖ｫ譎擾ｽｮ莠･貂戊舉・ｰ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('planning', 'vehicles', 'master_data', 'vehicles', '闖ｫ譎擾ｽｮ閧ｲ逡鷹怕鄙ｫ繝ｻ郢ｧ・ｹ郢ｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('planning', 'machine_types', 'master_data', 'machine_types', '隶匁ｺｽ・ｨ・ｮ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('planning', 'machines', 'master_data', 'machines', '隶匁ｻ難ｽ｢・ｰ騾｡・ｪ陷ｿ・ｷ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 鬩慕事・ｻ・｢髫ｪ閧ｲ蛻､繝ｻ蛹ｻ縺・ｹ晏干ﾎ懆氣繧臥舞繝ｻ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('planning', 'schedules', 'operations', 'schedules', '鬩慕事・ｻ・｢髫ｪ閧ｲ蛻､郢昴・繝ｻ郢晄じﾎ・),
  ('planning', 'operation_records', 'operations', 'operation_records', '鬩慕距逡題楜貅ｽ・ｸ・ｾ郢昴・繝ｻ郢晄じﾎ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- Equipment繝ｻ莠包ｽｿ譎擾ｽｮ閧ｲ逡鷹怕鬘費ｽｮ・｡騾・・縺咏ｹｧ・ｹ郢昴・ﾎ偵・閾･逡醍ｸｺ・ｮ郢晢ｽｫ郢晢ｽｼ郢昴・縺・ｹ晢ｽｳ郢ｧ・ｰ髫ｪ・ｭ陞ｳ繝ｻ
-- APP_ID = 'equipment'
-- ========================================

-- 陷茨ｽｱ鬨ｾ螢ｹ繝ｻ郢ｧ・ｹ郢ｧ・ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('equipment', 'users', 'master_data', 'users', '郢晢ｽｦ郢晢ｽｼ郢ｧ・ｶ郢晢ｽｼ驍ゑｽ｡騾・・繝ｦ郢晢ｽｼ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('equipment', 'managements_offices', 'master_data', 'managements_offices', '闔蛹ｺ・･・ｭ隰・郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('equipment', 'bases', 'master_data', 'bases', '闖ｫ譎擾ｽｮ莠･貂戊舉・ｰ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('equipment', 'vehicles', 'master_data', 'vehicles', '闖ｫ譎擾ｽｮ閧ｲ逡鷹怕鄙ｫ繝ｻ郢ｧ・ｹ郢ｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('equipment', 'machine_types', 'master_data', 'machine_types', '隶匁ｺｽ・ｨ・ｮ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('equipment', 'machines', 'master_data', 'machines', '隶匁ｻ難ｽ｢・ｰ騾｡・ｪ陷ｿ・ｷ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 霓､・ｹ隶諛・ｽｨ蛟ｬ鮖ｸ繝ｻ蛹ｻ縺・ｹ晏干ﾎ懆氣繧臥舞繝ｻ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('equipment', 'inspection_records', 'inspections', 'inspection_records', '霓､・ｹ隶諛・ｽｨ蛟ｬ鮖ｸ郢昴・繝ｻ郢晄じﾎ・),
  ('equipment', 'inspection_types', 'master_data', 'inspection_types', '霓､・ｹ隶諛翫■郢ｧ・､郢晏干繝ｻ郢ｧ・ｹ郢ｧ・ｿ')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- Failure繝ｻ蝓滂ｽｩ貊難ｽ｢・ｰ隰ｨ繝ｻ蝗ｿ驍ゑｽ｡騾・・縺咏ｹｧ・ｹ郢昴・ﾎ偵・閾･逡醍ｸｺ・ｮ郢晢ｽｫ郢晢ｽｼ郢昴・縺・ｹ晢ｽｳ郢ｧ・ｰ髫ｪ・ｭ陞ｳ繝ｻ
-- APP_ID = 'failure'
-- ========================================

-- 陷茨ｽｱ鬨ｾ螢ｹ繝ｻ郢ｧ・ｹ郢ｧ・ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('failure', 'users', 'master_data', 'users', '郢晢ｽｦ郢晢ｽｼ郢ｧ・ｶ郢晢ｽｼ驍ゑｽ｡騾・・繝ｦ郢晢ｽｼ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('failure', 'managements_offices', 'master_data', 'managements_offices', '闔蛹ｺ・･・ｭ隰・郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('failure', 'bases', 'master_data', 'bases', '闖ｫ譎擾ｽｮ莠･貂戊舉・ｰ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('failure', 'vehicles', 'master_data', 'vehicles', '闖ｫ譎擾ｽｮ閧ｲ逡鷹怕鄙ｫ繝ｻ郢ｧ・ｹ郢ｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('failure', 'machine_types', 'master_data', 'machine_types', '隶匁ｺｽ・ｨ・ｮ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ),
  ('failure', 'machines', 'master_data', 'machines', '隶匁ｻ難ｽ｢・ｰ騾｡・ｪ陷ｿ・ｷ郢晄ｧｭ縺帷ｹｧ・ｿ郢昴・繝ｻ郢晄じﾎ昴・莠･繝ｻ鬨ｾ螟ｲ・ｼ繝ｻ)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 隰ｨ繝ｻ蝗ｿ髫ｪ蛟ｬ鮖ｸ繝ｻ蛹ｻ縺・ｹ晏干ﾎ懆氣繧臥舞繝ｻ繝ｻ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('failure', 'fault_records', 'maintenance', 'fault_records', '隰ｨ繝ｻ蝗ｿ髫ｪ蛟ｬ鮖ｸ郢昴・繝ｻ郢晄じﾎ・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- 隶諛・ｽｨ・ｼ: 陷茨ｽｨ郢ｧ・｢郢晏干ﾎ懃ｸｺ・ｮ郢晢ｽｫ郢晢ｽｼ郢昴・縺・ｹ晢ｽｳ郢ｧ・ｰ驕抵ｽｺ髫ｱ繝ｻ
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

-- 陷茨ｽｱ鬨ｾ螢ｹ繝ｻ郢ｧ・ｹ郢ｧ・ｿ邵ｺ・ｮ陋ｻ・ｩ騾包ｽｨ霑･・ｶ雎輔・
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

