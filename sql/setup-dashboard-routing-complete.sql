-- ========================================
-- ダッシュボードUI用ルーティング設定（完全版）
-- ========================================
-- 
-- 【目的】
-- app_resource_routingテーブルにダッシュボードUIで使用する
-- すべてのリソースのルーティング情報を登録します。
--
-- 【適用タイミング】
-- - 初回セットアップ時
-- - 新しいテーブルを追加した時
-- - スキーマ構成を変更した時
--
-- 【動作】
-- - 既存のdashboard-ui用ルーティングを削除
-- - 最新のルーティング情報を登録
-- - 後方互換性を保持（デフォルトはmaster_dataスキーマ）
--
-- ========================================

-- 既存のダッシュボードUIルーティングを削除
DELETE FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui';

-- ========================================
-- 基本マスタテーブル
-- ========================================

-- ユーザー管理
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'users', 'public', 'users', true, 'ユーザーマスタ');

-- 事業所マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'managements_offices', 'public', 'management_offices', true, '事業所マスタ');

-- 保守基地マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'bases', 'public', 'bases', true, '保守基地マスタ');

-- 保守用車マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'vehicles', 'master_data', 'vehicles', true, '保守用車マスタ');

-- 機械番号マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'machines', 'public', 'machines', true, '機械番号マスタ');

-- 機種マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'machine_types', 'public', 'machine_types', true, '機種マスタ');

-- 保守用車種別マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'vehicle_types', 'master_data', 'vehicle_types', true, '保守用車種別マスタ');

-- 検修種別マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'inspection_types', 'public', 'inspection_types', true, '検修種別マスタ');

-- 検修周期・期間設定
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'inspection_schedules', 'public', 'inspection_schedules', true, '検修周期・期間設定');

-- 基地ドキュメント
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'base_documents', 'master_data', 'base_documents', true, '基地ドキュメント');

-- ========================================
-- アプリケーション設定テーブル
-- ========================================

-- アプリケーション設定
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'app_config', 'master_data', 'app_config', true, 'アプリケーション設定');

-- アプリケーション設定変更履歴
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'app_config_history', 'master_data', 'app_config_history', true, 'アプリケーション設定変更履歴');

-- ========================================
-- AI/RAG管理テーブル
-- ========================================

-- AI設定
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'ai_settings', 'master_data', 'ai_settings', true, 'AI設定マスタ');

-- AIナレッジデータ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'ai_knowledge_data', 'master_data', 'ai_knowledge_data', true, 'AIナレッジデータ');

-- ========================================
-- その他
-- ========================================

-- チャット履歴
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES 
    ('dashboard-ui', 'chat_history', 'master_data', 'chat_history', true, 'チャット履歴');

-- ========================================
-- 登録結果の確認
-- ========================================

SELECT 
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table,
    is_active,
    description
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;

-- ========================================
-- 成功メッセージ
-- ========================================

DO $$
DECLARE
    route_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO route_count
    FROM public.app_resource_routing
    WHERE app_id = 'dashboard-ui';
    
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ダッシュボードUIのルーティング設定が完了しました';
    RAISE NOTICE '登録されたルーティング数: %', route_count;
    RAISE NOTICE '============================================================';
    RAISE NOTICE '主要なルーティング:';
    RAISE NOTICE '  - users                    → public.users';
    RAISE NOTICE '  - managements_offices      → public.management_offices';
    RAISE NOTICE '  - bases                    → public.bases';
    RAISE NOTICE '  - vehicles                 → master_data.vehicles';
    RAISE NOTICE '  - machines                 → public.machines';
    RAISE NOTICE '  - machine_types            → public.machine_types';
    RAISE NOTICE '  - app_config               → master_data.app_config';
    RAISE NOTICE '  - ai_settings              → master_data.ai_settings';
    RAISE NOTICE '  - ai_knowledge_data        → master_data.ai_knowledge_data';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '次のステップ:';
    RAISE NOTICE '  1. サーバーを再起動してキャッシュをクリア';
    RAISE NOTICE '  2. /api/debug/routing でルーティング設定を確認';
    RAISE NOTICE '  3. 動作確認を実施';
    RAISE NOTICE '============================================================';
END $$;
