SELECT
  to_regclass('public.app_resource_routing') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_resource_routing' AND column_name = 'app_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_resource_routing' AND column_name = 'logical_resource_name'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_resource_routing' AND column_name = 'physical_schema'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_resource_routing' AND column_name = 'physical_table'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = to_regclass('public.app_resource_routing')
      AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (app_id, logical_resource_name)'
  )
  AS ok;
