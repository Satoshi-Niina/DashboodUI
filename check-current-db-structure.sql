-- 現在のデータベース構造を確認するスクリプト

-- 1. 存在するスキーマの一覧
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY schema_name;

-- 2. 各スキーマのテーブル一覧
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY table_schema, table_name;

-- 3. ダッシュボードUIで必要なテーブルの存在確認
SELECT 
    'users' as required_table,
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'master_data' AND table_name = 'users') THEN 'master_data'
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN 'public'
        ELSE 'NOT FOUND'
    END as found_in_schema
UNION ALL
SELECT 'managements_offices',
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'master_data' AND table_name = 'managements_offices') THEN 'master_data'
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'managements_offices') THEN 'public'
        ELSE 'NOT FOUND'
    END
UNION ALL
SELECT 'vehicles',
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'master_data' AND table_name = 'vehicles') THEN 'master_data'
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN 'public'
        ELSE 'NOT FOUND'
    END
UNION ALL
SELECT 'machines',
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'master_data' AND table_name = 'machines') THEN 'master_data'
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'machines') THEN 'public'
        ELSE 'NOT FOUND'
    END
UNION ALL
SELECT 'machine_types',
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'master_data' AND table_name = 'machine_types') THEN 'master_data'
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'machine_types') THEN 'public'
        ELSE 'NOT FOUND'
    END
UNION ALL
SELECT 'bases',
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'master_data' AND table_name = 'bases') THEN 'master_data'
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bases') THEN 'public'
        ELSE 'NOT FOUND'
    END;

-- 4. app_resource_routingテーブルの確認
SELECT 
    'app_resource_routing' as table_name,
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_resource_routing') THEN 'EXISTS in public'
        ELSE 'NOT FOUND'
    END as status;

-- 5. app_resource_routingの内容確認（テーブルが存在する場合）
SELECT 
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table,
    is_active
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;
