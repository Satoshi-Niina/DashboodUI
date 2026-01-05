-- ================================================================
-- Cloud SQL (free-trial-first-project) 完全修正SQL
-- master_dataスキーマの既存テーブルに合わせて修正
-- ================================================================

-- ============================================
-- STEP 1: ルーティングテーブルの修正
-- ============================================

-- managements_offices → management_offices に修正
UPDATE public.app_resource_routing 
SET physical_table = 'management_offices',
    updated_at = CURRENT_TIMESTAMP
WHERE app_id = 'dashboard-ui' 
  AND logical_resource_name = 'managements_offices';

-- ルーティング設定を確認
SELECT 'ルーティング設定確認' as step;
SELECT logical_resource_name, physical_schema, physical_table 
FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;

-- ============================================
-- STEP 2: machine_typesテーブルの拡張
-- ============================================

SELECT 'machine_typesテーブル拡張' as step;

-- 必要なカラムを追加
ALTER TABLE master_data.machine_types
ADD COLUMN IF NOT EXISTS type_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS type_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 既存のmachine_type_nameをtype_nameにコピー
UPDATE master_data.machine_types
SET type_name = machine_type_name
WHERE type_name IS NULL AND machine_type_name IS NOT NULL;

-- type_codeにユニーク制約を追加（データが無い場合のみ）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'machine_types_type_code_key'
    ) THEN
        ALTER TABLE master_data.machine_types 
        ADD CONSTRAINT machine_types_type_code_key UNIQUE (type_code);
    END IF;
END $$;

-- ============================================
-- STEP 3: machinesテーブルの拡張
-- ============================================

SELECT 'machinesテーブル拡張' as step;

-- 必要なカラムを追加（assigned_base_id, statusは削除済みなので追加しない）
ALTER TABLE master_data.machines
ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS manufacture_date DATE,
ADD COLUMN IF NOT EXISTS purchase_date DATE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================
-- STEP 4: インデックスの追加
-- ============================================

SELECT 'インデックス追加' as step;

-- vehiclesテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_vehicles_machine_id ON master_data.vehicles(machine_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_office_id ON master_data.vehicles(office_id);

-- machinesテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_machines_machine_type_id ON master_data.machines(machine_type_id);

-- machine_typesテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_machine_types_type_code ON master_data.machine_types(type_code);

-- ============================================
-- STEP 5: 外部キー制約の確認
-- ============================================

SELECT '外部キー制約確認' as step;

-- vehiclesテーブルのmachine_idに外部キー
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_vehicles_machine_id' 
        AND table_name = 'vehicles'
        AND table_schema = 'master_data'
    ) THEN
        ALTER TABLE master_data.vehicles 
        ADD CONSTRAINT fk_vehicles_machine_id 
        FOREIGN KEY (machine_id) REFERENCES master_data.machines(id) 
        ON DELETE RESTRICT;
    END IF;
END $$;

-- vehiclesテーブルのoffice_idに外部キー
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_vehicles_office_id' 
        AND table_name = 'vehicles'
        AND table_schema = 'master_data'
    ) THEN
        ALTER TABLE master_data.vehicles 
        ADD CONSTRAINT fk_vehicles_office_id 
        FOREIGN KEY (office_id) REFERENCES master_data.management_offices(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- machinesテーブルのmachine_type_idに外部キー
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_machines_machine_type_id' 
        AND table_name = 'machines'
        AND table_schema = 'master_data'
    ) THEN
        ALTER TABLE master_data.machines 
        ADD CONSTRAINT fk_machines_machine_type_id 
        FOREIGN KEY (machine_type_id) REFERENCES master_data.machine_types(id) 
        ON DELETE RESTRICT;
    END IF;
END $$;

-- ============================================
-- STEP 6: 最終確認
-- ============================================

SELECT '=== 修正完了 ===' as result;

-- ルーティング設定の最終確認
SELECT 'ルーティング設定:' as check;
SELECT logical_resource_name, physical_table 
FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;

-- management_officesテーブルのスキーマ確認
SELECT 'management_officesスキーマ:' as check;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'master_data' AND table_name = 'management_offices'
ORDER BY ordinal_position;

-- machine_typesテーブルのスキーマ確認
SELECT 'machine_typesスキーマ:' as check;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'master_data' AND table_name = 'machine_types'
ORDER BY ordinal_position;

-- machinesテーブルのスキーマ確認
SELECT 'machinesスキーマ:' as check;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'master_data' AND table_name = 'machines'
ORDER BY ordinal_position;

-- vehiclesテーブルのスキーマ確認
SELECT 'vehiclesスキーマ:' as check;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'master_data' AND table_name = 'vehicles'
ORDER BY ordinal_position;

SELECT '✅ すべての修正が完了しました！Cloud Runサービスを再起動してください。' as message;
