-- ========================================
-- 保守用車マスタテーブルの修正
-- 2026年1月5日
-- ========================================

-- vehiclesテーブルに型式認定と取得年月日のカラムを追加
ALTER TABLE master_data.vehicles 
ADD COLUMN IF NOT EXISTS type_certification VARCHAR(100),
ADD COLUMN IF NOT EXISTS acquisition_date DATE;

-- registration_numberカラムのコメントを更新（実際のカラム名は変更しない）
COMMENT ON COLUMN master_data.vehicles.registration_number IS '車両登録番号（旧フィールド、現在は使用しない場合あり）';
COMMENT ON COLUMN master_data.vehicles.type_certification IS '型式認定番号';
COMMENT ON COLUMN master_data.vehicles.acquisition_date IS '取得年月日';

-- 変更確認
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'master_data' 
  AND table_name = 'vehicles'
ORDER BY ordinal_position;
