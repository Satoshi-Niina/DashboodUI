-- 保守用車マスタと機種マスタのカラム再編成
-- 実行日: 2026-01-06

-- ========================================
-- 1. machine_types テーブルにカラム追加
-- ========================================

-- serial_number (製造番号) カラムを追加
ALTER TABLE master_data.machine_types 
ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);

-- model_name (メーカー型式) カラムを追加  
ALTER TABLE master_data.machine_types 
ADD COLUMN IF NOT EXISTS model_name VARCHAR(100);

-- ========================================
-- 2. vehicles テーブルからカラム削除
-- ========================================

-- vehicle_number カラムを削除
ALTER TABLE master_data.vehicles 
DROP COLUMN IF EXISTS vehicle_number CASCADE;

-- model (型式) カラムを削除
ALTER TABLE master_data.vehicles 
DROP COLUMN IF EXISTS model CASCADE;

-- vehicle_type カラムも不要なので削除
ALTER TABLE master_data.vehicles 
DROP COLUMN IF EXISTS vehicle_type CASCADE;

-- ========================================
-- 確認クエリ
-- ========================================

-- machine_types の全カラム確認
SELECT 'machine_types' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'machine_types'
ORDER BY ordinal_position;

-- vehicles の全カラム確認
SELECT 'vehicles' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'vehicles'
ORDER BY ordinal_position;
