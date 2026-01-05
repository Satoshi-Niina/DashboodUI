-- ========================================
-- 不要カラム削除SQLスクリプト
-- 2026年1月5日
-- ========================================

-- 事業所マスタから責任者名とメールアドレスを削除
ALTER TABLE master_data.managements_offices 
DROP COLUMN IF EXISTS manager_name,
DROP COLUMN IF EXISTS email;

-- 保守基地マスタから緯度・経度・収容台数・責任者名・電話番号を削除
ALTER TABLE master_data.bases 
DROP COLUMN IF EXISTS latitude,
DROP COLUMN IF EXISTS longitude,
DROP COLUMN IF EXISTS capacity,
DROP COLUMN IF EXISTS manager_name,
DROP COLUMN IF EXISTS phone_number;

-- 変更確認
SELECT 
    'managements_offices' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' 
  AND table_name = 'managements_offices'
ORDER BY ordinal_position;

SELECT 
    'bases' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'master_data' 
  AND table_name = 'bases'
ORDER BY ordinal_position;
