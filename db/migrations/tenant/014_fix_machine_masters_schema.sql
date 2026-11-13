-- 014_fix_machine_masters_schema.sql
-- kosei_db 等で不足していた public.machine_types の category, manufacturer, description 列および
-- public.machines の office_id (uuid) / serial_number / location 列を補正

DO $$
BEGIN
  -- 1. public.machine_types の不足列を追加
  ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS category varchar(100);
  ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS manufacturer varchar(255);
  ALTER TABLE public.machine_types ADD COLUMN IF NOT EXISTS description text;

  -- 2. public.machines の不足列を追加
  ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS serial_number varchar(255);
  ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS location varchar(255);

  -- 3. public.machines の office_id 型を bigint から uuid に補正
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'machines' 
      AND column_name = 'office_id' 
      AND data_type = 'bigint'
  ) THEN
    ALTER TABLE public.machines DROP COLUMN office_id;
    ALTER TABLE public.machines ADD COLUMN office_id uuid;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'machines' 
      AND column_name = 'office_id'
  ) THEN
    ALTER TABLE public.machines ADD COLUMN office_id uuid;
  END IF;
END $$;
