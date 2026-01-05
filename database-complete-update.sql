-- ========================================
-- データベース統合修正スクリプト
-- 2026年1月5日
-- CloudDB master_dataスキーマとpublicスキーマの整合性確保
-- ========================================

-- ============================================
-- STEP 1: master_dataスキーマのテーブル修正
-- ============================================

-- 事業所マスタから不要カラムを削除
ALTER TABLE master_data.managements_offices 
DROP COLUMN IF EXISTS manager_name,
DROP COLUMN IF EXISTS email;

-- 保守基地マスタから不要カラムを削除
ALTER TABLE master_data.bases 
DROP COLUMN IF EXISTS latitude,
DROP COLUMN IF EXISTS longitude,
DROP COLUMN IF EXISTS capacity,
DROP COLUMN IF EXISTS manager_name,
DROP COLUMN IF EXISTS phone_number;

-- 保守用車マスタに型式認定と取得年月日を追加
ALTER TABLE master_data.vehicles 
ADD COLUMN IF NOT EXISTS type_certification VARCHAR(100),
ADD COLUMN IF NOT EXISTS acquisition_date DATE;

-- カラムコメント追加
COMMENT ON COLUMN master_data.vehicles.type_certification IS '型式認定番号';
COMMENT ON COLUMN master_data.vehicles.acquisition_date IS '取得年月日';
COMMENT ON COLUMN master_data.vehicles.registration_number IS '車両登録番号（旧フィールド）';

-- ============================================
-- STEP 2: publicスキーマのルーティング設定確認
-- ============================================

-- app_resource_routingテーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS public.app_resource_routing (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    logical_resource_name VARCHAR(100) NOT NULL,
    physical_schema VARCHAR(50) NOT NULL,
    physical_table VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, logical_resource_name)
);

-- DashboardUIのルーティング設定を確認・更新
INSERT INTO public.app_resource_routing (app_id, logical_resource_name, physical_schema, physical_table, description, is_active)
VALUES 
    ('dashboard-ui', 'users', 'master_data', 'users', 'ユーザー管理テーブル', true),
    ('dashboard-ui', 'managements_offices', 'master_data', 'managements_offices', '事業所マスタテーブル', true),
    ('dashboard-ui', 'bases', 'master_data', 'bases', '保守基地マスタテーブル', true),
    ('dashboard-ui', 'machine_types', 'master_data', 'machine_types', '機種マスタテーブル', true),
    ('dashboard-ui', 'machines', 'master_data', 'machines', '機械番号マスタテーブル', true),
    ('dashboard-ui', 'vehicles', 'master_data', 'vehicles', '保守用車マスタテーブル', true)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
    physical_schema = EXCLUDED.physical_schema,
    physical_table = EXCLUDED.physical_table,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- STEP 3: 不要なテーブルの削除（オプション）
-- ============================================

-- 以下のテーブルは使用していないため削除できます
-- 実行前に必ず内容を確認してください

-- 古いルーティングテーブルがある場合は削除
DROP TABLE IF EXISTS public.table_routing_map CASCADE;
DROP TABLE IF EXISTS public.app_routing_config CASCADE;

-- ============================================
-- STEP 4: インデックスの最適化
-- ============================================

-- vehiclesテーブルの重要なカラムにインデックスを追加
CREATE INDEX IF NOT EXISTS idx_vehicles_machine_id ON master_data.vehicles(machine_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_office_id ON master_data.vehicles(office_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_acquisition_date ON master_data.vehicles(acquisition_date);

-- machinesテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_machines_machine_type_id ON master_data.machines(machine_type_id);
CREATE INDEX IF NOT EXISTS idx_machines_assigned_base_id ON master_data.machines(assigned_base_id);
CREATE INDEX IF NOT EXISTS idx_machines_status ON master_data.machines(status);

-- machine_typesテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_machine_types_type_code ON master_data.machine_types(type_code);

-- usersテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_users_username ON master_data.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON master_data.users(role);

-- ============================================
-- STEP 5: 外部キー制約の確認と追加
-- ============================================

-- vehiclesテーブルの外部キー（存在しない場合のみ追加）
DO $$ 
BEGIN
    -- machine_idの外部キー
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_vehicles_machine_id' 
        AND table_name = 'vehicles'
    ) THEN
        ALTER TABLE master_data.vehicles 
        ADD CONSTRAINT fk_vehicles_machine_id 
        FOREIGN KEY (machine_id) REFERENCES master_data.machines(id) 
        ON DELETE RESTRICT;
    END IF;

    -- office_idの外部キー
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_vehicles_office_id' 
        AND table_name = 'vehicles'
    ) THEN
        ALTER TABLE master_data.vehicles 
        ADD CONSTRAINT fk_vehicles_office_id 
        FOREIGN KEY (office_id) REFERENCES master_data.managements_offices(office_id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- machinesテーブルの外部キー
DO $$ 
BEGIN
    -- machine_type_idの外部キー
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_machines_machine_type_id' 
        AND table_name = 'machines'
    ) THEN
        ALTER TABLE master_data.machines 
        ADD CONSTRAINT fk_machines_machine_type_id 
        FOREIGN KEY (machine_type_id) REFERENCES master_data.machine_types(id) 
        ON DELETE RESTRICT;
    END IF;

    -- assigned_base_idの外部キー
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_machines_assigned_base_id' 
        AND table_name = 'machines'
    ) THEN
        ALTER TABLE master_data.machines 
        ADD CONSTRAINT fk_machines_assigned_base_id 
        FOREIGN KEY (assigned_base_id) REFERENCES master_data.bases(base_id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- STEP 7: 変更内容の確認
-- ============================================

-- 事業所マスタのカラム一覧
SELECT 'managements_offices' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'managements_offices'
ORDER BY ordinal_position;

-- 保守基地マスタのカラム一覧
SELECT 'bases' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'bases'
ORDER BY ordinal_position;

-- 保守用車マスタのカラム一覧
SELECT 'vehicles' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'vehicles'
ORDER BY ordinal_position;

-- 機種マスタのカラム一覧
SELECT 'machine_types' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'machine_types'
ORDER BY ordinal_position;

-- 機械番号マスタのカラム一覧
SELECT 'machines' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'machines'
ORDER BY ordinal_position;

-- ルーティング設定の確認
SELECT * FROM public.app_routing_config ORDER BY app_code;

-- テーブルマッピングの確認
SELECT * FROM public.table_routing_map WHERE app_code = 'dashboard-ui' ORDER BY table_name;

-- インデックスの確認
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'master_data' 
  AND tablename IN ('vehicles', 'machines', 'machine_types')
ORDER BY tablename, indexname;

-- 外部キー制約の確認
SELECT
    tc.table_schema, 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'master_data'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('vehicles', 'machines')
ORDER BY tc.table_name, tc.constraint_name;
