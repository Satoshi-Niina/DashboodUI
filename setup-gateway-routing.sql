-- ========================================
-- 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑・ 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν險ｭ螳・
-- DashboodUI逕ｨ縺ｮapp_resource_routing繝・・繧ｿ
-- ========================================

-- app_resource_routing繝・・繝悶Ν縺悟ｭ伜惠縺励↑縺・ｴ蜷医・菴懈・
CREATE TABLE IF NOT EXISTS public.app_resource_routing (
    routing_id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    logical_resource_name VARCHAR(100) NOT NULL,
    physical_schema VARCHAR(50) NOT NULL,
    physical_table VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(app_id, logical_resource_name)
);

-- 繧､繝ｳ繝・ャ繧ｯ繧ｹ菴懈・
CREATE INDEX IF NOT EXISTS idx_app_resource_routing_lookup 
ON public.app_resource_routing(app_id, logical_resource_name, is_active);

-- DashboodUI逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
-- APP_ID = 'dashboard-ui'

-- 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'users', 'master_data', 'users', '繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ユ繝ｼ繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 莠区･ｭ謇繝槭せ繧ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'managements_offices', 'master_data', 'managements_offices', '莠区･ｭ謇繝槭せ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'bases', 'master_data', 'bases', '菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 菫晏ｮ育畑霆翫・繧ｹ繧ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'vehicles', 'master_data', 'vehicles', '菫晏ｮ育畑霆翫・繧ｹ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 讖溽ｨｮ繝槭せ繧ｿ・・aster_data繧ｹ繧ｭ繝ｼ繝橸ｼ・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'machine_types', 'master_data', 'machine_types', '讖溽ｨｮ繝槭せ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ・・aster_data繧ｹ繧ｭ繝ｼ繝橸ｼ・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'machines', 'master_data', 'machines', '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'app_config', 'master_data', 'app_config', '繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳壹ユ繝ｼ繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳壼ｱ･豁ｴ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'app_config_history', 'master_data', 'app_config_history', '繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳壼､画峩螻･豁ｴ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 霆贋ｸ｡繧ｿ繧､繝励・繧ｹ繧ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'vehicle_types', 'master_data', 'vehicle_types', '霆贋ｸ｡繧ｿ繧､繝励・繧ｹ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 轤ｹ讀懊ち繧､繝励・繧ｹ繧ｿ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'inspection_types', 'master_data', 'inspection_types', '轤ｹ讀懊ち繧､繝励・繧ｹ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 逋ｻ骭ｲ邨先棡縺ｮ遒ｺ隱・
SELECT 
    routing_id,
    app_id,
    logical_resource_name,
    physical_schema || '.' || physical_table as full_path,
    is_active,
    created_at
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;

-- 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ邨ｱ險・
SELECT 
    app_id,
    COUNT(*) as total_routes,
    COUNT(*) FILTER (WHERE is_active = true) as active_routes,
    COUNT(*) FILTER (WHERE is_active = false) as inactive_routes
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
GROUP BY app_id;

-- 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上・繝・せ繝育畑繧ｯ繧ｨ繝ｪ萓・
-- 螳滄圀縺ｮserver.js縺ｧ菴ｿ逕ｨ縺輔ｌ繧九Ν繝ｼ繝・ぅ繝ｳ繧ｰ隗｣豎ｺ繧偵す繝溘Η繝ｬ繝ｼ繝・
DO $$
DECLARE
    test_route RECORD;
BEGIN
    RAISE NOTICE 'Gateway Routing Test for dashboard-ui';
    RAISE NOTICE '====================================';
    
    FOR test_route IN 
        SELECT 
            logical_resource_name,
            physical_schema || '."' || physical_table || '"' as resolved_path
        FROM public.app_resource_routing
        WHERE app_id = 'dashboard-ui' AND is_active = true
        ORDER BY logical_resource_name
    LOOP
        RAISE NOTICE '[Gateway] % 竊・%', test_route.logical_resource_name, test_route.resolved_path;
    END LOOP;
END $$;
