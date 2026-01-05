-- UIとDBの整合性確認と修正SQL

-- ========================================
-- 1. managements_officesテーブルに郵便番号カラムを追加
-- ========================================
-- UIには「郵便番号」フィールドがあるが、テーブルには存在しない
ALTER TABLE master_data.managements_offices 
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

-- 電話番号カラムの名前を確認（phoneとphone_numberの違い）
-- 現在のカラム名はphone、UIではphone_numberとして扱っている
-- server.jsもphone_numberを使用しているので、カラム名を統一
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'master_data' 
        AND table_name = 'managements_offices' 
        AND column_name = 'phone'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'master_data' 
        AND table_name = 'managements_offices' 
        AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE master_data.managements_offices 
        RENAME COLUMN phone TO phone_number;
    END IF;
END $$;

-- ========================================
-- 2. basesテーブルの確認
-- ========================================
-- UIの項目: 基地コード、基地名、所属事業所、所在地
-- テーブルのカラム: base_code, base_name, office_id, address, contact_info
-- 整合性OK

-- ========================================
-- 3. vehiclesテーブルの確認と修正
-- ========================================
-- vehicle_typeカラムは不要かもしれない（machine_type経由で取得するため）
-- ただし既存データがあるので残しておく

-- ========================================
-- 確認クエリ
-- ========================================

-- 事業所テーブルのカラム確認
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'managements_offices'
ORDER BY ordinal_position;

-- 保守基地テーブルのカラム確認
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'bases'
ORDER BY ordinal_position;

-- 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '===================================================';
    RAISE NOTICE 'テーブル構造の整合性修正が完了しました';
    RAISE NOTICE '  - managements_offices: postal_code追加';
    RAISE NOTICE '  - managements_offices: phone → phone_number';
    RAISE NOTICE '===================================================';
END $$;
