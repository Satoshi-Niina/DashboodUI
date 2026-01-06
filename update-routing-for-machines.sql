-- app_resource_routingテーブルの更新
-- 保守用車関連のルーティング設定

-- 既存のvehiclesエントリを削除（テーブルが存在しないため）
DELETE FROM public.app_resource_routing 
WHERE table_name = 'vehicles';

-- machinesテーブルのルーティング確認と更新
INSERT INTO public.app_resource_routing (
    app_name, 
    resource_type, 
    table_name, 
    schema_name, 
    connection_string, 
    is_active
)
VALUES (
    'dashboard-ui',
    'master_table',
    'machines',
    'master_data',
    '/cloudsql/maint-vehicle-management:asia-northeast2:free-trial-first-project',
    true
)
ON CONFLICT (app_name, resource_type, table_name) 
DO UPDATE SET 
    schema_name = EXCLUDED.schema_name,
    connection_string = EXCLUDED.connection_string,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- machine_typesテーブルのルーティング確認と更新
INSERT INTO public.app_resource_routing (
    app_name, 
    resource_type, 
    table_name, 
    schema_name, 
    connection_string, 
    is_active
)
VALUES (
    'dashboard-ui',
    'master_table',
    'machine_types',
    'master_data',
    '/cloudsql/maint-vehicle-management:asia-northeast2:free-trial-first-project',
    true
)
ON CONFLICT (app_name, resource_type, table_name) 
DO UPDATE SET 
    schema_name = EXCLUDED.schema_name,
    connection_string = EXCLUDED.connection_string,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- managements_officesテーブルのルーティング確認と更新
INSERT INTO public.app_resource_routing (
    app_name, 
    resource_type, 
    table_name, 
    schema_name, 
    connection_string, 
    is_active
)
VALUES (
    'dashboard-ui',
    'master_table',
    'managements_offices',
    'master_data',
    '/cloudsql/maint-vehicle-management:asia-northeast2:free-trial-first-project',
    true
)
ON CONFLICT (app_name, resource_type, table_name) 
DO UPDATE SET 
    schema_name = EXCLUDED.schema_name,
    connection_string = EXCLUDED.connection_string,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- 確認クエリ：dashboard-ui関連のルーティングを表示
SELECT 
    app_name,
    resource_type,
    table_name,
    schema_name,
    is_active,
    created_at,
    updated_at
FROM public.app_resource_routing
WHERE app_name = 'dashboard-ui'
ORDER BY table_name;
