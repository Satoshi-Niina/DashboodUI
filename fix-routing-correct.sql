-- 実際のapp_resource_routingテーブルの構造に基づいた修正
-- 既存データの形式: (カラム1, app_id, logical_resource_name, physical_schema, physical_table)

-- 既存のvehicles関連エントリを削除
DELETE FROM public.app_resource_routing 
WHERE physical_table = 'vehicles';

-- 既存のMACHINES/MACHINE_TYPESエントリを削除（あれば）
DELETE FROM public.app_resource_routing 
WHERE logical_resource_name IN ('MACHINES', 'MACHINE_TYPES');

-- machinesテーブルのルーティング追加
INSERT INTO public.app_resource_routing (
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table
)
VALUES (
    'master_data',
    'MACHINES',
    'master_data',
    'machines'
);

-- machine_typesテーブルのルーティング追加
INSERT INTO public.app_resource_routing (
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table
)
VALUES (
    'master_data',
    'MACHINE_TYPES',
    'master_data',
    'machine_types'
);

-- 確認クエリ
SELECT * FROM public.app_resource_routing 
WHERE physical_table IN ('machines', 'machine_types', 'managements_offices')
ORDER BY logical_resource_name;
