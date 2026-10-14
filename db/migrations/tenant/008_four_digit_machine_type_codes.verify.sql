SELECT (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'machine_types'
      AND column_name = 'display_code'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.machine_types
    WHERE display_code IS NULL
      OR display_code !~ '^(MT-)?[0-9]{4}$'
      OR display_code IN ('0000', 'MT-0000')
  )
  AND NOT EXISTS (
    SELECT display_code
    FROM public.machine_types
    GROUP BY display_code
    HAVING count(*) > 1
  )
  AND EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'machine_types'
      AND indexname = 'machine_types_display_code_uidx'
  )
) AS ok;
