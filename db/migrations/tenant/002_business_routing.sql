ALTER TABLE public.management_offices ADD COLUMN IF NOT EXISTS office_name varchar(255);
ALTER TABLE public.management_offices ADD COLUMN IF NOT EXISTS office_code varchar(100);
ALTER TABLE public.management_offices ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.management_offices ADD COLUMN IF NOT EXISTS postal_code varchar(20);
ALTER TABLE public.management_offices ADD COLUMN IF NOT EXISTS phone varchar(20);

ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS machine_type_name varchar(255);
ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS model_name varchar(255);
ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS type_name varchar(255);
ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS type_code varchar(100);
ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS category varchar(100);
ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS manufacturer varchar(255);
ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS machine_type_id uuid;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS serial_number varchar(255);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS status varchar(50);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS location varchar(255);

ALTER TABLE public.bases ADD COLUMN IF NOT EXISTS base_name varchar(255);
ALTER TABLE public.bases ADD COLUMN IF NOT EXISTS base_code varchar(100);
ALTER TABLE public.bases ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.bases ADD COLUMN IF NOT EXISTS postal_code varchar(20);

ALTER TABLE public.inspection_types ADD COLUMN IF NOT EXISTS inspection_type_name varchar(255);
ALTER TABLE public.inspection_types ADD COLUMN IF NOT EXISTS type_name varchar(255);
ALTER TABLE public.inspection_types ADD COLUMN IF NOT EXISTS type_code varchar(100);
ALTER TABLE public.inspection_types ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS machine_id uuid;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS inspection_type_id uuid;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS scheduled_date date;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS completed_date date;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS cycle_months integer;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS duration_days integer;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS dashboard_users_username_active_idx ON public.users (username, is_active);
CREATE INDEX IF NOT EXISTS dashboard_machines_type_idx ON public.machines (machine_type_id);
CREATE INDEX IF NOT EXISTS dashboard_bases_office_idx ON public.bases (office_id);
CREATE INDEX IF NOT EXISTS dashboard_inspection_machine_idx ON public.inspection_schedules (machine_id);
CREATE INDEX IF NOT EXISTS dashboard_inspection_type_idx ON public.inspection_schedules (inspection_type_id);
