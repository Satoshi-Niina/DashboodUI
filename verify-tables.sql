-- テーブル構造の確認スクリプト

-- 1. 事業所テーブル
SELECT 
    'managements_offices' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'managements_offices'
ORDER BY ordinal_position;

-- 2. 保守基地テーブル
SELECT 
    'bases' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'bases'
ORDER BY ordinal_position;

-- 3. 保守用車テーブル
SELECT 
    'vehicles' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'vehicles'
ORDER BY ordinal_position;

-- 4. 機械テーブル（master_data schema）
SELECT 
    'machines' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'machines'
ORDER BY ordinal_position;

-- 5. 機械タイプテーブル（master_data schema）
SELECT 
    'machine_types' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'machine_types'
ORDER BY ordinal_position;
