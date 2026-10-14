ALTER TABLE public.inspection_types
  ADD COLUMN IF NOT EXISTS machine_type_id uuid REFERENCES public.machine_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cycle_months integer,
  ADD COLUMN IF NOT EXISTS duration_days integer;

CREATE INDEX IF NOT EXISTS inspection_types_machine_type_id_idx
  ON public.inspection_types (machine_type_id);
