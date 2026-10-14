SELECT (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inspection_types'
      AND column_name = 'machine_type_id'
      AND data_type = 'uuid'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inspection_types'
      AND column_name = 'cycle_months'
      AND data_type = 'integer'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inspection_types'
      AND column_name = 'duration_days'
      AND data_type = 'integer'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'inspection_types'
      AND indexname = 'inspection_types_machine_type_id_idx'
  )
) AS ok;
