-- machine_types テーブルに欠落しているカラムを追加
-- 原因: type_code, manufacturer, category, description カラムが存在しない

-- 1. type_code カラムを追加（ユニーク制約付き）
ALTER TABLE master_data.machine_types 
ADD COLUMN IF NOT EXISTS type_code TEXT UNIQUE;

-- 2. type_name カラムを追加（machine_type_name を type_name にリネーム or 新規追加）
-- 既存の machine_type_name を type_name にリネーム
ALTER TABLE master_data.machine_types 
RENAME COLUMN machine_type_name TO type_name;

-- 3. manufacturer カラムを追加
ALTER TABLE master_data.machine_types 
ADD COLUMN IF NOT EXISTS manufacturer TEXT;

-- 4. category カラムを追加
ALTER TABLE master_data.machine_types 
ADD COLUMN IF NOT EXISTS category TEXT;

-- 5. description カラムを追加
ALTER TABLE master_data.machine_types 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 6. updated_at カラムを追加
ALTER TABLE master_data.machine_types 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 確認クエリ
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'master_data' 
  AND table_name = 'machine_types'
ORDER BY ordinal_position;
