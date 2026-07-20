-- ========================================
-- 既存の tenant_app_routings テーブルに icon_class カラムを追加
-- ========================================
-- 
-- 【目的】
-- Bootstrap Icons等のアイコンクラス名をサポートするため、
-- icon_class カラムを追加します。
--
-- 【使用方法】
-- 既にテーブルが存在している場合に実行してください。
--
-- ========================================

-- icon_class カラムを追加（既に存在する場合はスキップ）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenant_app_routings' 
        AND column_name = 'icon_class'
    ) THEN
        ALTER TABLE public.tenant_app_routings 
        ADD COLUMN icon_class VARCHAR(100) DEFAULT NULL;
        
        COMMENT ON COLUMN public.tenant_app_routings.icon_class 
        IS 'アイコンクラス（Bootstrap Icons等: bi-truck, bi-calendar 等）';
        
        RAISE NOTICE 'icon_class カラムを追加しました';
    ELSE
        RAISE NOTICE 'icon_class カラムは既に存在します';
    END IF;
END $$;

-- ========================================
-- サンプルデータの更新（icon_class の設定）
-- ========================================

-- 既存のレコードに icon_class を設定
UPDATE public.tenant_app_routings 
SET icon_class = 'bi-calendar-check'
WHERE app_id = 'planning' AND icon_class IS NULL;

UPDATE public.tenant_app_routings 
SET icon_class = 'bi-truck'
WHERE app_id = 'equipment' AND icon_class IS NULL;

UPDATE public.tenant_app_routings 
SET icon_class = 'bi-tools'
WHERE app_id = 'emergency' AND icon_class IS NULL;

UPDATE public.tenant_app_routings 
SET icon_class = 'bi-exclamation-triangle'
WHERE app_id = 'failure' AND icon_class IS NULL;

-- 確認クエリ
SELECT 
    tenant_key,
    app_id,
    app_name,
    icon,
    icon_class,
    is_active
FROM public.tenant_app_routings
ORDER BY tenant_key, display_order;
