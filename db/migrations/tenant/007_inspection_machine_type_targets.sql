ALTER TABLE public.inspection_schedules
  ADD COLUMN IF NOT EXISTS machine_type_id uuid;

ALTER TABLE public.inspection_schedules
  ADD COLUMN IF NOT EXISTS target_category varchar(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.inspection_schedules'::regclass
      AND conname = 'dashboard_inspection_machine_type_fk'
  ) THEN
    ALTER TABLE public.inspection_schedules
      ADD CONSTRAINT dashboard_inspection_machine_type_fk
      FOREIGN KEY (machine_type_id) REFERENCES public.machine_types(id);
  END IF;
END $$;

UPDATE public.inspection_schedules AS schedule
SET machine_type_id = machine.machine_type_id,
    machine_id = NULL
FROM public.machines AS machine
WHERE schedule.machine_id = machine.id
  AND schedule.machine_type_id IS NULL
  AND schedule.target_category IS NULL
  AND machine.machine_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dashboard_inspection_machine_type_idx
  ON public.inspection_schedules (machine_type_id);
