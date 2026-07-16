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
    ('dashboard-ui', 'users', 'public', 'users', true);

-- 事業所マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'managements_offices', 'public', 'management_offices', true);

-- 検修周期・期間設定
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'inspection_schedules', 'public', 'inspection_schedules', true);


-- 保守基地マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'bases', 'public', 'bases', true);

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
    ('dashboard-ui', 'machines', 'public', 'machines', true);

-- 機種マスタ
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active
) VALUES 
    ('dashboard-ui', 'machine_types', 'public', 'machine_types', true);

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
    RAISE NOTICE '  - users → public.users';
    RAISE NOTICE '  - managements_offices → public.management_offices';
    RAISE NOTICE '  - bases → public.bases';
    RAISE NOTICE '  - vehicles → master_data.vehicles';
    RAISE NOTICE '  - machines → public.machines';
    RAISE NOTICE '  - machine_types → public.machine_types';
    RAISE NOTICE '  - inspection_schedules → public.inspection_schedules';
    RAISE NOTICE '===================================================';
END $$;
