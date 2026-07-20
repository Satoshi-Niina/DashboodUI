-- ========================================
-- tenant_app_routings のみを使用した設計
-- ========================================
-- company_db_routing を使わず、tenant_app_routings だけで動作させる

BEGIN;

-- アプリルーティングテーブルの作成（DB接続情報も含める）
CREATE TABLE IF NOT EXISTS public.tenant_app_routings (
    id SERIAL PRIMARY KEY,
    tenant_key VARCHAR(100) NOT NULL,
    app_id VARCHAR(100) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    app_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(50) DEFAULT '📱',
    icon_class VARCHAR(100) DEFAULT NULL,
    description TEXT DEFAULT '',
    db_name VARCHAR(100) DEFAULT NULL,              -- ★ DB名を追加
    storage_bucket_name VARCHAR(255) DEFAULT NULL,  -- ★ バケット名を追加
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_app UNIQUE (tenant_key, app_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_app_routings_tenant ON public.tenant_app_routings(tenant_key);
CREATE INDEX IF NOT EXISTS idx_tenant_app_routings_active ON public.tenant_app_routings(tenant_key, is_active);

-- ========================================
-- テナント設定レコード（特別なapp_id='_config'）
-- ========================================
INSERT INTO public.tenant_app_routings (tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description, db_name, storage_bucket_name, is_active)
VALUES
    ('demo', '_config', 'Demo Configuration', '', -999, '', '', 'demo_db', 'demo_db', 'demo-uploads-bucket', false),
    ('daitetsu', '_config', 'Daitetsu Configuration', '', -999, '', '', 'daitetsu_db', 'daitetsu_db', 'daitetsu-uploads-bucket', false),
    ('kosei', '_config', 'Kosei Configuration', '', -999, '', '', 'kosei_db', 'kosei_db', 'kosei-uploads-bucket', false)
ON CONFLICT (tenant_key, app_id) DO UPDATE SET
    db_name = EXCLUDED.db_name,
    storage_bucket_name = EXCLUDED.storage_bucket_name,
    updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- アプリルーティングデータ
-- ========================================

-- Demo環境のアプリ
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

-- Daitetsu環境のアプリ
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

-- Kosei環境のアプリ
INSERT INTO public.tenant_app_routings (tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description, is_active)
VALUES
    ('kosei', 'planning', '計画・運用管理', 'https://railway-client-800711608362.asia-northeast2.run.app', 1, '📅', 'bi-calendar-check', '保守用車の運用計画作成から運用の実績を管理できます。', true),
    ('kosei', 'equipment', '保守用車管理', 'https://operation-management-client-800711608362.asia-northeast2.run.app', 2, '🚛', 'bi-truck', '仕業点検簿の表示から実績を記録します。', true)
ON CONFLICT (tenant_key, app_id) DO UPDATE SET
    app_name = EXCLUDED.app_name,
    app_url = EXCLUDED.app_url,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    icon_class = EXCLUDED.icon_class,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- 確認クエリ
SELECT '=== テナント設定 ===' AS section;
SELECT tenant_key, app_id, db_name, storage_bucket_name 
FROM public.tenant_app_routings 
WHERE app_id = '_config'
ORDER BY tenant_key;

SELECT '=== アプリ一覧 ===' AS section;
SELECT tenant_key, app_id, app_name, display_order, is_active 
FROM public.tenant_app_routings 
WHERE app_id != '_config'
ORDER BY tenant_key, display_order;
