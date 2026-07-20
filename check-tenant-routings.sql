-- Check tenant_app_routings table schema and data
\c common_db

-- Show table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'tenant_app_routings'
ORDER BY ordinal_position;

-- Show all data
SELECT tenant_id, app_id, 
       COALESCE(icon_class, 'NULL') as icon_class, 
       COALESCE(description, 'NULL') as description,
       target_db, target_schema
FROM tenant_app_routings
ORDER BY tenant_id, app_id;

-- Count entries per tenant
SELECT tenant_id, COUNT(*) as entry_count
FROM tenant_app_routings
GROUP BY tenant_id
ORDER BY tenant_id;
