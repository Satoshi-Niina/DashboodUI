SELECT
  (to_regclass('public.app_resource_routing') IS NULL
   OR (
     EXISTS (
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
   ))
  AS ok;
