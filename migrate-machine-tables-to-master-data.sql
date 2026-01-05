-- ========================================
-- 讖溽ｨｮ繝ｻ讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ縺ｮ繧ｹ繧ｭ繝ｼ繝樒ｧｻ陦後せ繧ｯ繝ｪ繝励ヨ
-- public 竊・master_data
-- ========================================

BEGIN;

-- 1. master_data 繧ｹ繧ｭ繝ｼ繝槭↓讖溽ｨｮ繝槭せ繧ｿ繝・・繝悶Ν繧剃ｽ懈・
CREATE TABLE IF NOT EXISTS master_data.machine_types (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(20) UNIQUE NOT NULL,
    type_name VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100),
    category VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. master_data 繧ｹ繧ｭ繝ｼ繝槭↓讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝・・繝悶Ν繧剃ｽ懈・
CREATE TABLE IF NOT EXISTS master_data.machines (
    id SERIAL PRIMARY KEY,
    machine_number VARCHAR(50) UNIQUE NOT NULL,
    machine_type_id INTEGER,
    serial_number VARCHAR(100),
    manufacture_date DATE,
    purchase_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    assigned_base_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_type_id) REFERENCES master_data.machine_types(id),
    FOREIGN KEY (assigned_base_id) REFERENCES master_data.bases(base_id)
);

-- 3. public 繧ｹ繧ｭ繝ｼ繝槭°繧峨ョ繝ｼ繧ｿ繧堤ｧｻ陦鯉ｼ亥ｭ伜惠縺吶ｋ蝣ｴ蜷茨ｼ・
DO $$
BEGIN
    -- 讖溽ｨｮ繝槭せ繧ｿ縺ｮ繝・・繧ｿ繧堤ｧｻ陦・
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'machine_types') THEN
        INSERT INTO master_data.machine_types (id, type_code, type_name, manufacturer, category, description, created_at, updated_at)
        SELECT id, type_code, type_name, manufacturer, category, description, created_at, updated_at
        FROM public.machine_types
        ON CONFLICT (type_code) DO NOTHING;
        
        -- 繧ｷ繝ｼ繧ｱ繝ｳ繧ｹ繧呈峩譁ｰ
        PERFORM setval('master_data.machine_types_id_seq', 
                      (SELECT COALESCE(MAX(id), 1) FROM master_data.machine_types));
        
        RAISE NOTICE '讖溽ｨｮ繝槭せ繧ｿ縺ｮ繝・・繧ｿ繧堤ｧｻ陦後＠縺ｾ縺励◆';
    END IF;

    -- 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ縺ｮ繝・・繧ｿ繧堤ｧｻ陦・
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'machines') THEN
        INSERT INTO master_data.machines (id, machine_number, machine_type_id, serial_number, manufacture_date, purchase_date, status, assigned_base_id, notes, created_at, updated_at)
        SELECT id, machine_number, machine_type_id, serial_number, manufacture_date, purchase_date, status, assigned_base_id, notes, created_at, updated_at
        FROM public.machines
        ON CONFLICT (machine_number) DO NOTHING;
        
        -- 繧ｷ繝ｼ繧ｱ繝ｳ繧ｹ繧呈峩譁ｰ
        PERFORM setval('master_data.machines_id_seq', 
                      (SELECT COALESCE(MAX(id), 1) FROM master_data.machines));
        
        RAISE NOTICE '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ縺ｮ繝・・繧ｿ繧堤ｧｻ陦後＠縺ｾ縺励◆';
    END IF;
END $$;

-- 4. vehicles 繝・・繝悶Ν縺ｮ螟夜Κ繧ｭ繝ｼ繧呈峩譁ｰ
ALTER TABLE master_data.vehicles DROP CONSTRAINT IF EXISTS fk_vehicles_machine_id;
ALTER TABLE master_data.vehicles 
    ADD CONSTRAINT fk_vehicles_machine_id 
    FOREIGN KEY (machine_id) REFERENCES master_data.machines(id) ON DELETE SET NULL;

-- 5. 繧､繝ｳ繝・ャ繧ｯ繧ｹ繧剃ｽ懈・
CREATE INDEX IF NOT EXISTS idx_machines_number ON master_data.machines(machine_number);
CREATE INDEX IF NOT EXISTS idx_machines_type ON master_data.machines(machine_type_id);
CREATE INDEX IF NOT EXISTS idx_machines_base ON master_data.machines(assigned_base_id);
CREATE INDEX IF NOT EXISTS idx_machine_types_code ON master_data.machine_types(type_code);

-- 6. 繧ｲ繝ｼ繝医え繧ｧ繧､繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繧呈峩譁ｰ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'machine_types', 'master_data', 'machine_types', '讖溽ｨｮ繝槭せ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = 'master_data',
  physical_table = 'machine_types',
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'machines', 'master_data', 'machines', '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = 'master_data',
  physical_table = 'machines',
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 7. 讀懆ｨｼ
DO $$
DECLARE
    type_count INTEGER;
    machine_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO type_count FROM master_data.machine_types;
    SELECT COUNT(*) INTO machine_count FROM master_data.machines;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ螳御ｺ・ｼ・;
    RAISE NOTICE '========================================';
    RAISE NOTICE '讖溽ｨｮ繝槭せ繧ｿ: % 莉ｶ', type_count;
    RAISE NOTICE '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ: % 莉ｶ', machine_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '豕ｨ諢・ public 繧ｹ繧ｭ繝ｼ繝槭・譌ｧ繝・・繝悶Ν縺ｯ謇句虚縺ｧ蜑企勁縺励※縺上□縺輔＞';
    RAISE NOTICE '  DROP TABLE IF EXISTS public.machines;';
    RAISE NOTICE '  DROP TABLE IF EXISTS public.machine_types;';
    RAISE NOTICE '========================================';
END $$;

COMMIT;
