-- ========================================
-- クエリ3: ダッシュボードUIで必要なテーブルの存在確認
-- ========================================
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
