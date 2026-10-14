ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS machine_number varchar(255);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS type_certification varchar(255);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS manufacture_date date;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS purchase_date date;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.bases ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE public.inspection_types ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.inspection_types ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
