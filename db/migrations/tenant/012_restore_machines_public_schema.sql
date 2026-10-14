-- 012_restore_machines_public_schema.sql
-- demo_db等のテナントDBで発生していたpublic.machine_types/public.machinesの消失を安全に修復
-- 既存データ、UUID、外部キー制約、インデックスを保持し、再実行可能（冪等）にする。

DO $$
BEGIN
  -- 1. public.machine_types が未存在で public.deprecated_machine_types が存在する場合、RENAMEして復元
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'machine_types'
  ) AND EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deprecated_machine_types'
  ) THEN
    ALTER TABLE public.deprecated_machine_types RENAME TO machine_types;
  END IF;

  -- 2. public.machines が未存在で public.deprecated_machines が存在する場合、RENAMEして復元
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'machines'
  ) AND EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deprecated_machines'
  ) THEN
    ALTER TABLE public.deprecated_machines RENAME TO machines;
  END IF;

  -- 3. master_data.machine_types が存在する場合に同期
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'master_data' AND tablename = 'machine_types'
  ) AND EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'machine_types'
  ) THEN
    INSERT INTO master_data.machine_types (id, machine_type_name, created_at, updated_at)
    SELECT id, COALESCE(machine_type_name, type_name, model_name, type_code, '標準機種'), COALESCE(created_at, now()), COALESCE(updated_at, now())
    FROM public.machine_types
    ON CONFLICT (id) DO UPDATE
      SET machine_type_name = EXCLUDED.machine_type_name,
          updated_at = EXCLUDED.updated_at;
  END IF;

  -- 4. master_data.machines が存在する場合に同期
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'master_data' AND tablename = 'machines'
  ) AND EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'machines'
  ) THEN
    INSERT INTO master_data.machines (id, machine_number, machine_type_id, status, notes, created_at, updated_at)
    SELECT m.id, m.machine_number, m.machine_type_id, COALESCE(m.status, 'active'), m.notes, COALESCE(m.created_at, now()), COALESCE(m.updated_at, now())
    FROM public.machines m
    ON CONFLICT (machine_number) DO UPDATE
      SET machine_type_id = EXCLUDED.machine_type_id,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at;
  END IF;
END $$;
