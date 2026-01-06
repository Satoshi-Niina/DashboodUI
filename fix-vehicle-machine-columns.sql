-- 保守用車マスタと機種マスタのカラム再編成（最終版）
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

-- office_id (管理事業所) カラムを追加
ALTER TABLE master_data.machines 
ADD COLUMN IF NOT EXISTS office_id INTEGER;

-- ========================================
-- 3. vehicles テーブルを完全削除
-- ========================================

-- vehiclesテーブルを削除（保守用車マスタは機械番号マスタに統合）
DROP TABLE IF EXISTS master_data.vehicles CASCADE;

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
