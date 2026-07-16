-- ========================================
-- 検修マスタテーブル作成
-- ========================================
-- 機種・機械番号毎に検修種別による検修周期（月単位）と検修期間（日）を設定

-- 検修種別マスタテーブル
CREATE TABLE IF NOT EXISTS public.inspection_types (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(50) NOT NULL UNIQUE,           -- 検修種別コード（例: A検修、B検修、全検など）
    type_name VARCHAR(100) NOT NULL,                 -- 検修種別名
    description TEXT,                                 -- 説明
    display_order INT DEFAULT 0,                      -- 表示順序
    is_active BOOLEAN DEFAULT true,                   -- 有効フラグ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.inspection_types IS '検修種別マスタテーブル';
COMMENT ON COLUMN public.inspection_types.type_code IS '検修種別コード';
COMMENT ON COLUMN public.inspection_types.type_name IS '検修種別名';
COMMENT ON COLUMN public.inspection_types.description IS '説明';
COMMENT ON COLUMN public.inspection_types.display_order IS '表示順序';
COMMENT ON COLUMN public.inspection_types.is_active IS '有効フラグ';

-- 検修周期・期間設定テーブル（機種・機械番号毎）
CREATE TABLE IF NOT EXISTS public.inspection_schedules (
    id SERIAL PRIMARY KEY,
    machine_id INT,                                   -- 保守用車ID（public.machines.id）
    target_category VARCHAR(100),                     -- カテゴリー指定（カテゴリ単位の検修設定）
    inspection_type_id INT NOT NULL,                  -- 検修種別ID
    cycle_months INT NOT NULL,                        -- 検修周期（月単位）
    duration_days INT NOT NULL,                       -- 検修期間（日数）
    remarks TEXT,                                     -- 備考
    is_active BOOLEAN DEFAULT true,                   -- 有効フラグ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE,
    FOREIGN KEY (inspection_type_id) REFERENCES public.inspection_types(id) ON DELETE CASCADE,
    CHECK (machine_id IS NOT NULL OR target_category IS NOT NULL)
);

COMMENT ON TABLE public.inspection_schedules IS '検修周期・期間設定テーブル（機種・機械番号毎）';
COMMENT ON COLUMN public.inspection_schedules.machine_id IS '保守用車ID';
COMMENT ON COLUMN public.inspection_schedules.target_category IS 'カテゴリー指定';
COMMENT ON COLUMN public.inspection_schedules.inspection_type_id IS '検修種別ID';
COMMENT ON COLUMN public.inspection_schedules.cycle_months IS '検修周期（月単位）';
COMMENT ON COLUMN public.inspection_schedules.duration_days IS '検修期間（日数）';
COMMENT ON COLUMN public.inspection_schedules.remarks IS '備考';
COMMENT ON COLUMN public.inspection_schedules.is_active IS '有効フラグ';

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_machine_id ON public.inspection_schedules(machine_id);
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_target_category ON public.inspection_schedules(target_category);
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_inspection_type_id ON public.inspection_schedules(inspection_type_id);
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_is_active ON public.inspection_schedules(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inspection_schedules_target_key
    ON public.inspection_schedules (COALESCE(machine_id::text, target_category), inspection_type_id);

-- 初期データ挿入（検修種別サンプル）
INSERT INTO public.inspection_types (type_code, type_name, description, display_order) VALUES
    ('A_INSPECTION', 'A検修', '日常点検と小規模な整備', 1),
    ('B_INSPECTION', 'B検修', '定期的な点検と部品交換', 2),
    ('C_INSPECTION', 'C検修', '大規模な点検と整備', 3),
    ('GENERAL_INSPECTION', '全般検査', '法定検査に準じた総合検査', 4),
    ('SPECIAL_INSPECTION', '特別検査', '臨時または特定部品の検査', 5)
ON CONFLICT (type_code) DO NOTHING;

-- 更新日時を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION master_data.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- inspection_types テーブルのトリガー
DROP TRIGGER IF EXISTS update_inspection_types_updated_at ON public.inspection_types;
CREATE TRIGGER update_inspection_types_updated_at
    BEFORE UPDATE ON public.inspection_types
    FOR EACH ROW
    EXECUTE FUNCTION master_data.update_updated_at_column();

-- inspection_schedules テーブルのトリガー
DROP TRIGGER IF EXISTS update_inspection_schedules_updated_at ON public.inspection_schedules;
CREATE TRIGGER update_inspection_schedules_updated_at
    BEFORE UPDATE ON public.inspection_schedules
    FOR EACH ROW
    EXECUTE FUNCTION master_data.update_updated_at_column();

-- 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ 検修マスタテーブルが正常に作成されました';
    RAISE NOTICE '📋 テーブル: public.inspection_types';
    RAISE NOTICE '📋 テーブル: public.inspection_schedules';
END $$;
