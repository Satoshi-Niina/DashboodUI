-- ========================================
-- クエリ4: app_resource_routingテーブルの確認と内容
-- ========================================
SELECT 
    'app_resource_routing' as table_name,
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_resource_routing') THEN 'EXISTS in public'
        ELSE 'NOT FOUND'
    END as status;

-- ルーティングテーブルが存在する場合のみ実行
SELECT 
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table,
    is_active
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;
