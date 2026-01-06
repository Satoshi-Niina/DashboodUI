-- app_resource_routingテーブルの構造確認
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_resource_routing'
ORDER BY ordinal_position;

-- 現在のデータ確認
SELECT * FROM public.app_resource_routing LIMIT 10;
