-- 実際のapp_resource_routingテーブルの構造に基づいた修正
-- データから推測: (id, カテゴリ/アプリ, 論理名, 物理スキーマ, 物理テーブル)

-- 既存のvehicles関連エントリを削除
DELETE FROM public.app_resource_routing 
WHERE physical_table = 'vehicles';

-- machinesテーブルのルーティング追加/更新
INSERT INTO public.app_resource_routing (
    id,
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table
)
VALUES (
    (SELECT COALESCE(MAX(id), 0) + 1 FROM public.app_resource_routing),
    'master_data',
    'MACHINES',
    'master_data',
    'machines'
)
ON CONFLICT (logical_resource_name) 
DO UPDATE SET 
    physical_schema = EXCLUDED.physical_schema,
    physical_table = EXCLUDED.physical_table;

-- machine_typesテーブルのルーティング追加/更新
INSERT INTO public.app_resource_routing (
    id,
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table
)
VALUES (
    (SELECT COALESCE(MAX(id), 0) + 1 FROM public.app_resource_routing),
    'master_data',
    'MACHINE_TYPES',
    'master_data',
    'machine_types'
)
ON CONFLICT (logical_resource_name) 
DO UPDATE SET 
    physical_schema = EXCLUDED.physical_schema,
    physical_table = EXCLUDED.physical_table;

-- 確認クエリ
SELECT * FROM public.app_resource_routing 
WHERE physical_table IN ('machines', 'machine_types', 'managements_offices')
ORDER BY id;
