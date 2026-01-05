-- Cloud SQL (free-trial-first-project) で実行するSQL
-- ルーティングテーブルを修正

-- 1. managements_offices → management_offices に修正
UPDATE public.app_resource_routing 
SET physical_table = 'management_offices',
    updated_at = CURRENT_TIMESTAMP
WHERE app_id = 'dashboard-ui' 
  AND logical_resource_name = 'managements_offices';

-- 2. machine_typesテーブルに必要なカラムを追加
ALTER TABLE master_data.machine_types
ADD COLUMN IF NOT EXISTS type_code VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS type_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 3. 既存のmachine_type_nameをtype_nameにコピー
UPDATE master_data.machine_types
SET type_name = machine_type_name
WHERE type_name IS NULL AND machine_type_name IS NOT NULL;

-- 4. machinesテーブルに必要なカラムを追加
ALTER TABLE master_data.machines
ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS manufacture_date DATE,
ADD COLUMN IF NOT EXISTS purchase_date DATE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 確認
SELECT logical_resource_name, physical_table 
FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;
