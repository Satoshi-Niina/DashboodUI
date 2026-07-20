-- ========================================
-- テナント別アプリルーティングテーブル
-- ========================================
-- 
-- 【目的】
-- 各テナントが契約しているアプリケーションの一覧を管理します。
-- 従来の横持ち型（カラム追加型）から、縦持ち型（レコード追加型）に移行することで、
-- 新しいアプリを追加する際にテーブル定義の変更が不要になります。
--
-- 【移行経緯】
-- 従来: company_db_routing テーブルに vehicle_app_url, planning_app_url などのカラムを追加
-- 新方式: tenant_app_routings テーブルにレコードとして追加
--
-- ========================================

-- テーブルが既に存在する場合は削除（開発環境のみ）
-- DROP TABLE IF EXISTS public.tenant_app_routings CASCADE;

-- テナント別アプリルーティングテーブルの作成
CREATE TABLE IF NOT EXISTS public.tenant_app_routings (
    id SERIAL PRIMARY KEY,
    tenant_key VARCHAR(100) NOT NULL,              -- テナントキー（例: 'demo', 'daitetsu', 'kosei'）
    app_id VARCHAR(100) NOT NULL,                  -- アプリケーションID（例: 'vehicle', 'planning', 'emergency'）
    app_name VARCHAR(255) NOT NULL,                -- アプリケーション名（例: '保守用車管理システム'）
    app_url TEXT NOT NULL,                         -- アプリケーションURL
    display_order INTEGER DEFAULT 0,               -- 表示順序（小さい方が先に表示）
    icon VARCHAR(50) DEFAULT '📱',                 -- アイコン（絵文字）
    icon_class VARCHAR(100) DEFAULT NULL,          -- アイコンクラス（Bootstrap Icons等: 'bi-truck', 'bi-calendar'）
    description TEXT DEFAULT '',                   -- アプリの説明
    is_active BOOLEAN DEFAULT true,                -- 有効フラグ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_app UNIQUE (tenant_key, app_id)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_tenant_app_routings_tenant ON public.tenant_app_routings(tenant_key);
CREATE INDEX IF NOT EXISTS idx_tenant_app_routings_active ON public.tenant_app_routings(tenant_key, is_active);

-- コメントの追加
COMMENT ON TABLE public.tenant_app_routings IS 'テナント別アプリケーションルーティングテーブル（縦持ち型）';
COMMENT ON COLUMN public.tenant_app_routings.tenant_key IS 'テナントキー（company_id と対応）';
COMMENT ON COLUMN public.tenant_app_routings.app_id IS 'アプリケーション識別子';
COMMENT ON COLUMN public.tenant_app_routings.app_name IS 'アプリケーション表示名';
COMMENT ON COLUMN public.tenant_app_routings.app_url IS 'アプリケーションのURL';
COMMENT ON COLUMN public.tenant_app_routings.display_order IS '表示順序（昇順）';
COMMENT ON COLUMN public.tenant_app_routings.icon IS 'アプリアイコン（絵文字: 📱, 🚛 等）';
COMMENT ON COLUMN public.tenant_app_routings.icon_class IS 'アイコンクラス（Bootstrap Icons等: bi-truck, bi-calendar 等）';
COMMENT ON COLUMN public.tenant_app_routings.description IS 'アプリの説明文';
COMMENT ON COLUMN public.tenant_app_routings.is_active IS 'アクティブフラグ（false の場合は非表示）';

-- ========================================
-- サンプルデータの投入
-- ========================================

-- デモテナントのアプリ設定icon_class, description, is_active)
VALUES
    ('demo', 'planning', '計画・運用管理', 'https://railway-client-800711608362.asia-northeast2.run.app', 1, '📅', 'bi-calendar-check', '保守用車の運用計画作成から運用の実績を管理できます。', true),
    ('demo', 'equipment', '保守用車管理', 'https://operation-management-client-800711608362.asia-northeast2.run.app', 2, '🚛', 'bi-truck', '仕業点検簿の表示から実績を記録します。', true),
    ('demo', 'emergency', '応急復旧支援', 'https://emergency-client-800711608362.asia-northeast2.run.app', 3, '🛠️', 'bi-tools', '機械故障等の技術支援します。', true),
    ('demo', 'failure', '機械故障管理', 'https://machine-failure-client-800711608362.asia-northeast2.run.app', 4, '⚠️', 'bi-exclamation-triangle', '機械故障の原因分析と対策策定、発生状況と対応履歴を管理します。', true)
ON CONFLICT (tenant_key, app_id) DO UPDATE SET
    app_name = EXCLUDED.app_name,
    app_url = EXCLUDED.app_url,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    icon_class = EXCLUDED.icon_classUDED.display_order,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- 他のテナント例（必要に応じて追加）
-- daitetsu テナントのアプリ設定icon_class, description, is_active)
VALUES
    ('daitetsu', 'planning', '計画・運用管理', 'https://railway-client-800711608362.asia-northeast2.run.app', 1, '📅', 'bi-calendar-check', '保守用車の運用計画作成から運用の実績を管理できます。', true),
    ('daitetsu', 'equipment', '保守用車管理', 'https://operation-management-client-800711608362.asia-northeast2.run.app', 2, '🚛', 'bi-truck', '仕業点検簿の表示から実績を記録します。', true),
    ('daitetsu', 'emergency', '応急復旧支援', 'https://emergency-client-800711608362.asia-northeast2.run.app', 3, '🛠️', 'bi-tools', '機械故障等の技術支援します。', true)
ON CONFLICT (tenant_key, app_id) DO UPDATE SET
    app_name = EXCLUDED.app_name,
    app_url = EXCLUDED.app_url,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    icon_class = EXCLUDED.icon_class,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- kosei テナントのアプリ設定（例）
INSERT INTO public.tenant_app_routings (tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description, is_active)
VALUES
    ('kosei', 'equipment', '保守用車管理', 'https://operation-management-client-800711608362.asia-northeast2.run.app', 1, '🚛', 'bi-truck', '仕業点検簿の表示から実績を記録します。', true),
    ('kosei', 'planning', '計画・運用管理', 'https://railway-client-800711608362.asia-northeast2.run.app', 2, '📅', 'bi-calendar-check', '保守用車の運用計画作成から運用の実績を管理できます。', true)
ON CONFLICT (tenant_key, app_id) DO UPDATE SET
    app_name = EXCLUDED.app_name,
    app_url = EXCLUDED.app_url,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    icon_class = EXCLUDED.icon_classUDED.display_order,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- 確認クエリ
-- ========================================

-- 全テナントのアプリ一覧を表示
SELECT 
    tenant_key,
    app_id,
    app_name,
    LEFT(app_url, 50) as app_url_preview,
    dcon_class,
    is_active
FROM public.tenant_app_routings
ORDER BY tenant_key, display_order;

-- 特定テナント（demo）のアクティブなアプリ一覧
SELECT 
    app_id,
    app_name,
    app_url,
    icon,
    icon_classname,
    app_url,
    icon,
    description
FROM public.tenant_app_routings
WHERE tenant_key = 'demo' AND is_active = true
ORDER BY display_order;
