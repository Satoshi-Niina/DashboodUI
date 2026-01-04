-- ========================================
-- ゲートウェイ方式: ルーティングテーブル設定
-- DashboodUI用のapp_resource_routingデータ
-- ========================================

-- app_resource_routingテーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS public.app_resource_routing (
    routing_id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    logical_resource_name VARCHAR(100) NOT NULL,
    physical_schema VARCHAR(50) NOT NULL,
    physical_table VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(app_id, logical_resource_name)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_app_resource_routing_lookup 
ON public.app_resource_routing(app_id, logical_resource_name, is_active);

-- DashboodUI用のルーティング設定
-- APP_ID = 'dashboard-ui'

-- ユーザー管理
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'users', 'master_data', 'users', 'ユーザー管理テーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 事業所マスタ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'managements_offices', 'master_data', 'managements_offices', '事業所マスタテーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 保守基地マスタ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'bases', 'master_data', 'bases', '保守基地マスタテーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 保守用車マスタ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'vehicles', 'master_data', 'vehicles', '保守用車マスタテーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 機種マスタ（master_dataスキーマ）
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'machine_types', 'master_data', 'machine_types', '機種マスタテーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 機械番号マスタ（master_dataスキーマ）
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'machines', 'master_data', 'machines', '機械番号マスタテーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- アプリケーション設定
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'app_config', 'master_data', 'app_config', 'アプリケーション設定テーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- アプリケーション設定履歴
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'app_config_history', 'master_data', 'app_config_history', 'アプリケーション設定変更履歴テーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 車両タイプマスタ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'vehicle_types', 'master_data', 'vehicle_types', '車両タイプマスタテーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 点検タイプマスタ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'inspection_types', 'master_data', 'inspection_types', '点検タイプマスタテーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 登録結果の確認
SELECT 
    routing_id,
    app_id,
    logical_resource_name,
    physical_schema || '.' || physical_table as full_path,
    is_active,
    created_at
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;

-- ルーティング統計
SELECT 
    app_id,
    COUNT(*) as total_routes,
    COUNT(*) FILTER (WHERE is_active = true) as active_routes,
    COUNT(*) FILTER (WHERE is_active = false) as inactive_routes
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
GROUP BY app_id;

-- ゲートウェイ方式のテスト用クエリ例
-- 実際のserver.jsで使用されるルーティング解決をシミュレート
DO $$
DECLARE
    test_route RECORD;
BEGIN
    RAISE NOTICE 'Gateway Routing Test for dashboard-ui';
    RAISE NOTICE '====================================';
    
    FOR test_route IN 
        SELECT 
            logical_resource_name,
            physical_schema || '."' || physical_table || '"' as resolved_path
        FROM public.app_resource_routing
        WHERE app_id = 'dashboard-ui' AND is_active = true
        ORDER BY logical_resource_name
    LOOP
        RAISE NOTICE '[Gateway] % → %', test_route.logical_resource_name, test_route.resolved_path;
    END LOOP;
END $$;
