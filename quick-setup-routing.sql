-- app_resource_routingテーブルにis_activeカラムを追加

-- is_activeカラムを追加（存在しない場合）
ALTER TABLE public.app_resource_routing 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 既存データをすべてアクティブ化
UPDATE public.app_resource_routing 
SET is_active = true
WHERE app_id = 'dashboard-ui';

-- 確認
SELECT routing_id, app_id, logical_resource_name, physical_schema, physical_table, is_active 
FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui' 
ORDER BY logical_resource_name;
