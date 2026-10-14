CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS master_data;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(255) NOT NULL UNIQUE,
  display_name varchar(255),
  password_hash text,
  password varchar(255),
  role varchar(100) NOT NULL DEFAULT 'operator',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name varchar(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password varchar(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role varchar(100) DEFAULT 'operator';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.management_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name varchar(255),
  office_code varchar(100),
  address text,
  postal_code varchar(20),
  phone varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.management_offices ADD COLUMN IF NOT EXISTS postal_code varchar(20);

CREATE TABLE IF NOT EXISTS public.machine_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_type_name varchar(255),
  model_name varchar(255),
  type_name varchar(255),
  type_code varchar(100),
  category varchar(100),
  manufacturer varchar(255),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_type_id uuid REFERENCES public.machine_types(id),
  serial_number varchar(255),
  status varchar(50),
  location varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_name varchar(255),
  base_code varchar(100),
  office_id uuid REFERENCES public.management_offices(id),
  postal_code varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bases ADD COLUMN IF NOT EXISTS postal_code varchar(20);

CREATE TABLE IF NOT EXISTS public.inspection_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_type_name varchar(255),
  type_name varchar(255),
  type_code varchar(100),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inspection_types ADD COLUMN IF NOT EXISTS type_name varchar(255);
ALTER TABLE public.inspection_types ADD COLUMN IF NOT EXISTS type_code varchar(100);

CREATE TABLE IF NOT EXISTS public.inspection_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid REFERENCES public.machines(id),
  inspection_type_id uuid REFERENCES public.inspection_types(id),
  scheduled_date date,
  completed_date date,
  cycle_months integer,
  duration_days integer,
  remarks text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS cycle_months integer;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS duration_days integer;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.inspection_schedules ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS master_data.app_config (
  config_key varchar(255) PRIMARY KEY,
  config_value text,
  updated_by varchar(255),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_data.app_config_history (
  id bigserial PRIMARY KEY,
  config_key varchar(255) NOT NULL,
  old_value text,
  new_value text,
  updated_by varchar(255),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_data.ai_settings (
  id bigserial PRIMARY KEY,
  app_id varchar(100) NOT NULL,
  setting_type varchar(100) NOT NULL,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, setting_type)
);

CREATE TABLE IF NOT EXISTS master_data.ai_knowledge_data (
  id bigserial PRIMARY KEY,
  title text,
  content text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_data.ai_knowledge_chunks (
  id bigserial PRIMARY KEY,
  knowledge_id bigint REFERENCES master_data.ai_knowledge_data(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
