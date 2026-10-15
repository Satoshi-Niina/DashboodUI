SELECT (
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'machine_types' AND column_name = 'display_code'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.machine_types WHERE display_code IS NULL
  )
) AS ok;
