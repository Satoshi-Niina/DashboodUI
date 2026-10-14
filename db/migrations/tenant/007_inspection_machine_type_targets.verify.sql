SELECT (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inspection_schedules'
      AND column_name = 'machine_type_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inspection_schedules'
      AND column_name = 'target_category'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.inspection_schedules'::regclass
      AND conname = 'dashboard_inspection_machine_type_fk'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'inspection_schedules'
      AND indexname = 'dashboard_inspection_machine_type_idx'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.inspection_schedules AS schedule
    JOIN public.machines AS machine ON schedule.machine_id = machine.id
    WHERE schedule.machine_type_id IS NULL
      AND schedule.target_category IS NULL
      AND machine.machine_type_id IS NOT NULL
  )
) AS ok;
