-- 保守用車マスタと機種マスタのカラム再編成（完全版）
-- 実行日: 2026-01-06

-- ========================================
-- 1. machine_types テーブル
-- ========================================

-- model_name (メーカー型式) カラムを追加  
ALTER TABLE master_data.machine_types 
ADD COLUMN IF NOT EXISTS model_name VARCHAR(100);

-- serial_number は削除（machinesのserial_numberと重複のため）
ALTER TABLE master_data.machine_types 
DROP COLUMN IF EXISTS serial_number CASCADE;

-- ========================================
-- 2. machines テーブル
-- ========================================

-- type_certification (型式認定) カラムを追加
ALTER TABLE master_data.machines 
ADD COLUMN IF NOT EXISTS type_certification VARCHAR(100);

-- ========================================
-- 3. vehicles テーブルからカラム削除
-- ========================================

-- vehicle_number カラムを削除
ALTER TABLE master_data.vehicles 
DROP COLUMN IF EXISTS vehicle_number CASCADE;

-- model (型式) カラムを削除
ALTER TABLE master_data.vehicles 
DROP COLUMN IF EXISTS model CASCADE;

-- vehicle_type カラムを削除
ALTER TABLE master_data.vehicles 
DROP COLUMN IF EXISTS vehicle_type CASCADE;

-- manufacture_date (製造年月日) カラムを削除
ALTER TABLE master_data.vehicles 
DROP COLUMN IF EXISTS manufacture_date CASCADE;

-- acquisition_date (取得年月日) カラムを削除
ALTER TABLE master_data.vehicles 
DROP COLUMN IF EXISTS acquisition_date CASCADE;

-- type_certification (型式認定) カラムを削除（machinesに移動）
ALTER TABLE master_data.vehicles 
DROP COLUMN IF EXISTS type_certification CASCADE;

-- ========================================
-- 確認クエリ
-- ========================================

-- machine_types の全カラム確認
SELECT 'machine_types' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'machine_types'
ORDER BY ordinal_position;

-- machines の全カラム確認
SELECT 'machines' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'machines'
ORDER BY ordinal_position;

-- vehicles の全カラム確認
SELECT 'vehicles' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'vehicles'
ORDER BY ordinal_position;
