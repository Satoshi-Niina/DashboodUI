-- 011_reorganize_tenant_auth_and_masters.sql
-- テナントDB 認証・業務マスタ・業務データの整理と強化
-- 目標構成:
-- 1. ユーザー、パスワードハッシュ、ロール、権限、所属 (users, roles, permissions, organizations, sites, memberships)
-- 2. 事業所、保守基地、保守用車、検修などのマスタ (management_offices, bases, machine_types, machines, inspection_items)
-- 3. 各アプリの業務データ、設定、監査ログ (inspection_records, inspection_runs, inspection_record_items, audit_logs)
-- 4. テナントDB自身のマイグレーション履歴 (dashboard_schema_migrations)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS master_data;
CREATE SCHEMA IF NOT EXISTS operations;

-- 1. テナント組織・所属・RBACテーブル (空DB対応)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  code varchar(100),
  name varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) UNIQUE,
  name varchar(255),
  role_key varchar(100),
  role_name varchar(255)
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) UNIQUE,
  description text,
  permission_key varchar(100),
  permission_name varchar(255)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id),
  permission_id uuid NOT NULL REFERENCES public.permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  site_id uuid REFERENCES public.sites(id),
  title varchar(100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  user_id uuid NOT NULL REFERENCES public.users(id),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  system_key varchar(50) NOT NULL DEFAULT 'ops',
  role_id uuid NOT NULL REFERENCES public.roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id, system_key, role_id)
);

-- 2. テナント設定テーブル
CREATE TABLE IF NOT EXISTS master_data.app_config (
  config_key varchar(100) PRIMARY KEY,
  config_value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations.system_settings (
  id bigserial PRIMARY KEY,
  category varchar(100),
  key varchar(100),
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. 業務マスタテーブル (空DB対応)
CREATE TABLE IF NOT EXISTS master_data.management_offices (
  office_id bigserial PRIMARY KEY,
  office_code varchar(100) UNIQUE,
  office_name varchar(255) NOT NULL,
  address text,
  postal_code varchar(20),
  phone varchar(50),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_data.bases (
  base_id bigserial PRIMARY KEY,
  base_code varchar(100),
  base_name varchar(255) NOT NULL,
  office_id bigint REFERENCES master_data.management_offices(office_id),
  address text,
  contact_info text,
  location varchar(255),
  postal_code varchar(20),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_data.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_number varchar(100) NOT NULL UNIQUE,
  machine_type_id uuid,
  registration_number varchar(100),
  status varchar(50) DEFAULT 'active',
  notes text,
  legacy_vehicle_id text,
  office_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. 業務点検データテーブル (空DB対応)
CREATE TABLE IF NOT EXISTS operations.deprecated_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id),
  vehicle_code varchar(100),
  machine_type varchar(100),
  machine_number varchar(100),
  maker varchar(100),
  model varchar(100),
  status varchar(50) DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations.inspection_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id),
  vehicle_id uuid REFERENCES operations.deprecated_vehicles(id),
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  inspector_user_id uuid REFERENCES public.users(id),
  result_json jsonb,
  remarks text,
  inspection_place varchar(255),
  start_time time,
  end_time time,
  supervisor_name varchar(100),
  inspector_name varchar(100),
  office varchar(255),
  inspection_base_id bigint REFERENCES master_data.bases(base_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations.inspection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid REFERENCES operations.inspection_records(id),
  inspection_date date,
  machine_type_id varchar(100),
  machine_number_id varchar(100),
  inspection_timing varchar(50),
  started_meter varchar(50),
  ended_meter varchar(50),
  travel_distance numeric,
  inspector_name varchar(100),
  supervisor_name varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations.inspection_items (
  id bigserial PRIMARY KEY,
  part text,
  timing varchar(50),
  equipment text,
  check_point text,
  criteria text,
  inspection_timing varchar(50),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations.inspection_record_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid REFERENCES operations.inspection_records(id),
  item_id bigint REFERENCES operations.inspection_items(id),
  status varchar(20),
  value text,
  measured_value numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations.inspection_measurement_results (
  id bigserial PRIMARY KEY,
  inspection_id uuid REFERENCES operations.inspection_records(id),
  item_id bigint REFERENCES operations.inspection_items(id),
  measured_value numeric,
  value_text text,
  unit varchar(50),
  judged_status varchar(20),
  measured_at timestamptz,
  measured_by varchar(100),
  source_record_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations.work_content_master (
  id bigserial PRIMARY KEY,
  work_content_code varchar(100) UNIQUE,
  work_content_name varchar(255) NOT NULL,
  category varchar(100),
  display_order int DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations.inspection_run_work_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_run_id uuid REFERENCES operations.inspection_runs(id),
  work_content_id bigint REFERENCES operations.work_content_master(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations.audit_logs (
  id bigserial PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id),
  user_id uuid REFERENCES public.users(id),
  action varchar(100) NOT NULL,
  target_resource varchar(100),
  details jsonb,
  ip_address varchar(50),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. インデックス強化
CREATE INDEX IF NOT EXISTS idx_tenant_users_login
  ON public.users (username, is_active);

CREATE INDEX IF NOT EXISTS idx_tenant_user_org_lookup
  ON public.user_org_memberships (user_id, org_id);

CREATE INDEX IF NOT EXISTS idx_tenant_user_role_lookup
  ON public.user_role_assignments (user_id, org_id, role_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'master_data' AND tablename = 'machines') THEN
    CREATE INDEX IF NOT EXISTS idx_tenant_machines_number_lookup
      ON master_data.machines (machine_number, status);
  ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'machines') THEN
    CREATE INDEX IF NOT EXISTS idx_tenant_machines_number_lookup
      ON public.machines (machine_number, status);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'master_data' AND tablename = 'bases') THEN
    CREATE INDEX IF NOT EXISTS idx_tenant_bases_lookup
      ON master_data.bases (base_code);
  ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bases') THEN
    CREATE INDEX IF NOT EXISTS idx_tenant_bases_lookup
      ON public.bases (base_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_inspection_runs_rec
  ON operations.inspection_runs (inspection_id);

CREATE INDEX IF NOT EXISTS idx_tenant_inspection_rec_items_rec
  ON operations.inspection_record_items (record_id);

CREATE INDEX IF NOT EXISTS idx_tenant_inspection_measurements_rec
  ON operations.inspection_measurement_results (inspection_id);
