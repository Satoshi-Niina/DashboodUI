-- 本番環境のルーティングテーブル確認スクリプト

-- 1. dashboard-ui用のルーティング確認
SELECT 
    routing_id,
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table,
    is_active
FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui' 
ORDER BY logical_resource_name;

-- 2. 全てのアクティブなルーティング確認
SELECT 
    app_id,
    COUNT(*) as routing_count
FROM public.app_resource_routing 
WHERE is_active = true
GROUP BY app_id;

-- 3. 必要なテーブルが存在するか確認
SELECT 
    table_schema,
    table_name,
    CASE 
        WHEN table_schema = 'master_data' AND table_name IN ('users', 'managements_offices', 'bases', 'vehicles', 'machines', 'machine_types') 
        THEN '✓ 必要なテーブル'
        ELSE '他のテーブル'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'master_data'
ORDER BY table_name;

-- 4. 各テーブルのレコード数確認（エラーを無視）
DO $$
BEGIN
    -- usersテーブル
    BEGIN
        RAISE NOTICE 'users: %', (SELECT COUNT(*) FROM master_data.users);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'users: テーブルが存在しないか、アクセスできません';
    END;
    
    -- managements_officesテーブル
    BEGIN
        RAISE NOTICE 'managements_offices: %', (SELECT COUNT(*) FROM master_data.managements_offices);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'managements_offices: テーブルが存在しないか、アクセスできません';
    END;
    
    -- basesテーブル
    BEGIN
        RAISE NOTICE 'bases: %', (SELECT COUNT(*) FROM master_data.bases);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'bases: テーブルが存在しないか、アクセスできません';
    END;
    
    -- vehiclesテーブル
    BEGIN
        RAISE NOTICE 'vehicles: %', (SELECT COUNT(*) FROM master_data.vehicles);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'vehicles: テーブルが存在しないか、アクセスできません';
    END;
    
    -- machinesテーブル
    BEGIN
        RAISE NOTICE 'machines: %', (SELECT COUNT(*) FROM master_data.machines);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'machines: テーブルが存在しないか、アクセスできません';
    END;
    
    -- machine_typesテーブル
    BEGIN
        RAISE NOTICE 'machine_types: %', (SELECT COUNT(*) FROM master_data.machine_types);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'machine_types: テーブルが存在しないか、アクセスできません';
    END;
END $$;
