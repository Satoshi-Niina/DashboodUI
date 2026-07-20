-- ========================================
-- tenant_app_routings テーブルを本番DBに適用
-- ========================================

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

-- デモテナントのアプリ設定
INSERT INTO public.tenant_app_routings (tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description, is_active)
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
    icon_class = EXCLUDED.icon_class,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- daitetsu テナントのアプリ設定
INSERT INTO public.tenant_app_routings (tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description, is_active)
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

-- kosei テナントのアプリ設定
INSERT INTO public.tenant_app_routings (tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description, is_active)
VALUES
    ('kosei', 'equipment', '保守用車管理', 'https://operation-management-client-800711608362.asia-northeast2.run.app', 1, '🚛', 'bi-truck', '仕業点検簿の表示から実績を記録します。', true),
    ('kosei', 'planning', '計画・運用管理', 'https://railway-client-800711608362.asia-northeast2.run.app', 2, '📅', 'bi-calendar-check', '保守用車の運用計画作成から運用の実績を管理できます。', true)
ON CONFLICT (tenant_key, app_id) DO UPDATE SET
    app_name = EXCLUDED.app_name,
    app_url = EXCLUDED.app_url,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    icon_class = EXCLUDED.icon_class,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- 確認クエリ
SELECT 
    tenant_key,
    app_id,
    app_name,
    icon,
    icon_class,
    description,
    is_active
FROM public.tenant_app_routings
ORDER BY tenant_key, display_order;
