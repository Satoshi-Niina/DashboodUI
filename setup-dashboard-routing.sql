-- ダッシュボードUI用のルーティング設定スクリプト
-- このスクリプトは、app_resource_routingテーブルにダッシュボードUIのルーティング情報を登録します

-- まず、既存のダッシュボードUIのルーティングを削除
DELETE FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui';

-- ダッシュボードUIで使用するテーブルのルーティングを登録
-- 注意: physical_schemaとphysical_tableは実際のDB構造に合わせて調整してください

-- ユーザー管理
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'users', 'master_data', 'users', true);

-- 事業所マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'managements_offices', 'master_data', 'managements_offices', true);

-- 保守基地マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'bases', 'master_data', 'bases', true);

-- 保守用車マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'vehicles', 'master_data', 'vehicles', true);

-- 機械番号マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'machines', 'master_data', 'machines', true);

-- 機種マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'machine_types', 'master_data', 'machine_types', true);

-- 登録結果の確認
SELECT 
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table,
    is_active
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;

-- 成功メッセージ
DO $$
BEGIN
    RAISE NOTICE '===================================================';
    RAISE NOTICE 'ダッシュボードUIのルーティング設定が完了しました';
    RAISE NOTICE '登録されたルーティング:';
    RAISE NOTICE '  - users → master_data.users';
    RAISE NOTICE '  - managements_offices → master_data.managements_offices';
    RAISE NOTICE '  - bases → master_data.bases';
    RAISE NOTICE '  - vehicles → master_data.vehicles';
    RAISE NOTICE '  - machines → master_data.machines';
    RAISE NOTICE '  - machine_types → master_data.machine_types';
    RAISE NOTICE '===================================================';
END $$;
