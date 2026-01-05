-- 事業所マスタと保守用車マスタのテーブル修正スクリプト
-- 既存のテーブルがある場合は、正しい構造に修正します

-- まず既存の外部キー制約を削除（存在する場合）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_vehicles_office_id' 
        AND table_name = 'vehicles'
        AND table_schema = 'master_data'
    ) THEN
        ALTER TABLE master_data.vehicles DROP CONSTRAINT fk_vehicles_office_id;
        RAISE NOTICE '既存の外部キー制約 fk_vehicles_office_id を削除しました';
    END IF;
END $$;

-- 事業所テーブルの postal_code と phone_number カラムを追加（存在しない場合）
ALTER TABLE master_data.managements_offices
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100);

-- 正しい外部キー制約を作成
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
        FOREIGN KEY (office_id) REFERENCES master_data.managements_offices(office_id) 
        ON DELETE SET NULL;
        RAISE NOTICE '新しい外部キー制約 fk_vehicles_office_id を作成しました';
    END IF;
END $$;

-- bases テーブルの外部キー制約も修正
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bases_office_id_fkey' 
        AND table_name = 'bases'
        AND table_schema = 'master_data'
    ) THEN
        ALTER TABLE master_data.bases DROP CONSTRAINT bases_office_id_fkey;
        RAISE NOTICE '既存の外部キー制約 bases_office_id_fkey を削除しました';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_bases_office_id' 
        AND table_name = 'bases'
        AND table_schema = 'master_data'
    ) THEN
        ALTER TABLE master_data.bases 
        ADD CONSTRAINT fk_bases_office_id 
        FOREIGN KEY (office_id) REFERENCES master_data.managements_offices(office_id) 
        ON DELETE SET NULL;
        RAISE NOTICE '新しい外部キー制約 fk_bases_office_id を作成しました';
    END IF;
END $$;

-- 確認クエリ
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname IN ('fk_vehicles_office_id', 'fk_bases_office_id')
  AND connamespace = 'master_data'::regnamespace;
