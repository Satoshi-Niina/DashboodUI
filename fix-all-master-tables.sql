-- 全マスタテーブルの欠落カラムを一括追加
-- 実行日: 2026-01-06

-- ========================================
-- 1. managements_offices テーブル
-- ========================================
-- システムが使用: office_code, office_name, office_type, address, postal_code, phone_number
-- 現在のDB: office_id, office_code, office_name, office_type, address, phone

-- postal_code カラムを追加
ALTER TABLE master_data.managements_offices 
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);

-- phone を phone_number にリネーム（システムとの整合性）
ALTER TABLE master_data.managements_offices 
RENAME COLUMN phone TO phone_number;

-- ========================================
-- 2. bases テーブル
-- ========================================
-- システムが使用: base_code, base_name, office_id, location, address, postal_code
-- 現在のDB: base_id, base_code, base_name, office_id, address, contact_info

-- location カラムを追加
ALTER TABLE master_data.bases 
ADD COLUMN IF NOT EXISTS location TEXT;

-- postal_code カラムを追加
ALTER TABLE master_data.bases 
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);

-- ========================================
-- 3. vehicles テーブル（既に追加済みだが念のため確認）
-- ========================================
-- machine_id と office_id は既に追加済み

-- ========================================
-- 4. machines テーブル
-- ========================================
-- システムが使用: machine_number, machine_type_id, serial_number, manufacture_date, purchase_date, notes
-- すべて既に存在するため追加不要

-- ========================================
-- 5. machine_types テーブル（既に修正済み）
-- ========================================
-- type_code, type_name, manufacturer, category, description は既に追加済み

-- ========================================
-- 確認クエリ
-- ========================================

-- managements_offices の全カラム確認
SELECT 'managements_offices' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'managements_offices'
ORDER BY ordinal_position;

-- bases の全カラム確認
SELECT 'bases' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'bases'
ORDER BY ordinal_position;

-- vehicles の全カラム確認
SELECT 'vehicles' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'vehicles'
ORDER BY ordinal_position;

-- machines の全カラム確認
SELECT 'machines' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'machines'
ORDER BY ordinal_position;

-- machine_types の全カラム確認
SELECT 'machine_types' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'machine_types'
ORDER BY ordinal_position;
