-- ========================================
-- 繝・・繝悶Ν讒矩菫ｮ豁｣繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ繧ｹ繧ｯ繝ｪ繝励ヨ
-- 譌｢蟄倥ョ繝ｼ繧ｿ繧剃ｿ晄戟縺励↑縺後ｉ繧ｫ繝ｩ繝繧定ｿｽ蜉繝ｻ菫ｮ豁｣
-- ========================================

-- 1. managements_offices 繝・・繝悶Ν縺ｮ菫ｮ豁｣
-- 蠢・ｦ√↑繧ｫ繝ｩ繝繧定ｿｽ蜉
ALTER TABLE master_data.managements_offices 
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email VARCHAR(100);

-- 譌｢蟄倥・ phone 繧ｫ繝ｩ繝縺後≠繧後・ phone_number 縺ｫ繝・・繧ｿ繧堤ｧｻ陦後＠縺ｦ縺九ｉ蜑企勁
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'master_data' 
      AND table_name = 'managements_offices' 
      AND column_name = 'phone'
  ) THEN
    UPDATE master_data.managements_offices 
    SET phone_number = phone 
    WHERE phone_number IS NULL AND phone IS NOT NULL;
    
    ALTER TABLE master_data.managements_offices DROP COLUMN phone;
  END IF;
END $$;

-- 2. bases 繝・・繝悶Ν縺ｮ菫ｮ豁｣
ALTER TABLE master_data.bases 
  ADD COLUMN IF NOT EXISTS location VARCHAR(200),
  ADD COLUMN IF NOT EXISTS address VARCHAR(200),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS capacity INTEGER;

-- 譌｢蟄倥・ contact_info 縺九ｉ phone_number 縺ｫ繝・・繧ｿ繧偵さ繝斐・・亥庄閭ｽ縺ｪ蝣ｴ蜷茨ｼ・
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'master_data' 
      AND table_name = 'bases' 
      AND column_name = 'contact_info'
  ) THEN
    UPDATE master_data.bases 
    SET phone_number = contact_info 
    WHERE phone_number IS NULL 
      AND contact_info IS NOT NULL
      AND contact_info ~ '^[0-9\-]+$';
  END IF;
END $$;

-- 3. vehicles 繝・・繝悶Ν縺ｮ菫ｮ豁｣
ALTER TABLE master_data.vehicles 
  ADD COLUMN IF NOT EXISTS machine_id INTEGER,
  ADD COLUMN IF NOT EXISTS office_id INTEGER,
  ADD COLUMN IF NOT EXISTS model VARCHAR(50),
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- vehicle_type 繧ｫ繝ｩ繝縺・NOT NULL 縺ｮ蝣ｴ蜷医・ NULL 繧定ｨｱ蜿ｯ
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'master_data' 
      AND table_name = 'vehicles' 
      AND column_name = 'vehicle_type'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE master_data.vehicles 
      ALTER COLUMN vehicle_type DROP NOT NULL;
  END IF;
END $$;

-- 4. master_data.machines 繝・・繝悶Ν縺悟ｭ伜惠縺吶ｋ縺薙→繧堤｢ｺ隱・
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

-- 5. 螟夜Κ繧ｭ繝ｼ蛻ｶ邏・ｒ霑ｽ蜉・亥ｭ伜惠縺励↑縺・ｴ蜷茨ｼ・
DO $$ 
BEGIN
  -- vehicles.machine_id 竊・machines.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_vehicles_machine_id'
  ) THEN
    ALTER TABLE master_data.vehicles 
      ADD CONSTRAINT fk_vehicles_machine_id 
      FOREIGN KEY (machine_id) REFERENCES master_data.machines(id)
      ON DELETE SET NULL;
  END IF;

  -- vehicles.office_id 竊・managements_offices.office_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_vehicles_office_id'
  ) THEN
    ALTER TABLE master_data.vehicles 
      ADD CONSTRAINT fk_vehicles_office_id 
      FOREIGN KEY (office_id) REFERENCES master_data.managements_offices(office_id)
      ON DELETE SET NULL;
  END IF;

  -- bases.office_id 竊・managements_offices.office_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_bases_office_id'
  ) THEN
    ALTER TABLE master_data.bases 
      ADD CONSTRAINT fk_bases_office_id 
      FOREIGN KEY (office_id) REFERENCES master_data.managements_offices(office_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 6. 遒ｺ隱阪け繧ｨ繝ｪ
SELECT 
    'managements_offices' as table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'managements_offices'
ORDER BY ordinal_position;

SELECT 
    'bases' as table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'bases'
ORDER BY ordinal_position;

SELECT 
    'vehicles' as table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'vehicles'
ORDER BY ordinal_position;
