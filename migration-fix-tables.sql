-- ========================================
-- テーブル構造修正マイグレーションスクリプト
-- 既存データを保持しながらカラムを追加・修正
-- ========================================

-- 1. managements_offices テーブルの修正
-- 必要なカラムを追加
ALTER TABLE master_data.managements_offices 
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email VARCHAR(100);

-- 既存の phone カラムがあれば phone_number にデータを移行してから削除
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

-- 2. bases テーブルの修正
ALTER TABLE master_data.bases 
  ADD COLUMN IF NOT EXISTS location VARCHAR(200),
  ADD COLUMN IF NOT EXISTS address VARCHAR(200),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS capacity INTEGER;

-- 既存の contact_info から phone_number にデータをコピー（可能な場合）
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

-- 3. vehicles テーブルの修正
ALTER TABLE master_data.vehicles 
  ADD COLUMN IF NOT EXISTS machine_id INTEGER,
  ADD COLUMN IF NOT EXISTS office_id INTEGER,
  ADD COLUMN IF NOT EXISTS model VARCHAR(50),
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- vehicle_type カラムが NOT NULL の場合は NULL を許可
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

-- 4. master_data.machines テーブルが存在することを確認
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

-- 5. 外部キー制約を追加（存在しない場合）
DO $$ 
BEGIN
  -- vehicles.machine_id → machines.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_vehicles_machine_id'
  ) THEN
    ALTER TABLE master_data.vehicles 
      ADD CONSTRAINT fk_vehicles_machine_id 
      FOREIGN KEY (machine_id) REFERENCES master_data.machines(id)
      ON DELETE SET NULL;
  END IF;

  -- vehicles.office_id → managements_offices.office_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_vehicles_office_id'
  ) THEN
    ALTER TABLE master_data.vehicles 
      ADD CONSTRAINT fk_vehicles_office_id 
      FOREIGN KEY (office_id) REFERENCES master_data.managements_offices(office_id)
      ON DELETE SET NULL;
  END IF;

  -- bases.office_id → managements_offices.office_id
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

-- 6. 確認クエリ
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
