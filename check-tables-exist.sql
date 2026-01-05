-- テーブル存在確認スクリプト
-- このスクリプトは必要なテーブルが存在するかチェックします

-- master_dataスキーマの確認
SELECT EXISTS(
    SELECT FROM information_schema.schemata 
    WHERE schema_name = 'master_data'
) as master_data_schema_exists;

-- 各テーブルの存在確認
SELECT 
    'managements_offices' as table_name,
    EXISTS(
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'master_data' 
        AND table_name = 'managements_offices'
    ) as exists,
    (
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ')
        FROM information_schema.columns
        WHERE table_schema = 'master_data' 
        AND table_name = 'managements_offices'
    ) as columns
UNION ALL
SELECT 
    'vehicles' as table_name,
    EXISTS(
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'master_data' 
        AND table_name = 'vehicles'
    ) as exists,
    (
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ')
        FROM information_schema.columns
        WHERE table_schema = 'master_data' 
        AND table_name = 'vehicles'
    ) as columns
UNION ALL
SELECT 
    'machines' as table_name,
    EXISTS(
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'master_data' 
        AND table_name = 'machines'
    ) as exists,
    (
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ')
        FROM information_schema.columns
        WHERE table_schema = 'master_data' 
        AND table_name = 'machines'
    ) as columns
UNION ALL
SELECT 
    'machine_types' as table_name,
    EXISTS(
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'master_data' 
        AND table_name = 'machine_types'
    ) as exists,
    (
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ')
        FROM information_schema.columns
        WHERE table_schema = 'master_data' 
        AND table_name = 'machine_types'
    ) as columns
UNION ALL
SELECT 
    'bases' as table_name,
    EXISTS(
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'master_data' 
        AND table_name = 'bases'
    ) as exists,
    (
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ')
        FROM information_schema.columns
        WHERE table_schema = 'master_data' 
        AND table_name = 'bases'
    ) as columns;

-- app_resource_routingテーブルの確認
SELECT 
    'app_resource_routing' as table_name,
    EXISTS(
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'app_resource_routing'
    ) as exists;

-- ルーティングデータの確認
SELECT 
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table,
    is_active
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;
