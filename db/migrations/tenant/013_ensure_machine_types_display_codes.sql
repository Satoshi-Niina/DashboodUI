-- 013_ensure_machine_types_display_codes.sql
-- machine_types の display_code が NULL のレコードに一意な display_code (MT-xxxx) を自動採番して付与

DO $$
DECLARE
  rec RECORD;
  next_num int;
  candidate_code varchar(50);
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'machine_types' AND column_name = 'display_code'
  ) THEN
    SELECT COALESCE(MAX(
      CASE 
        WHEN display_code ~ '^MT-[0-9]+$' THEN SUBSTRING(display_code FROM 4)::int
        WHEN display_code ~ '^[0-9]+$' THEN display_code::int
        ELSE 0
      END
    ), 0) + 1 INTO next_num
    FROM public.machine_types;

    FOR rec IN 
      SELECT id FROM public.machine_types WHERE display_code IS NULL ORDER BY created_at, id
    LOOP
      candidate_code := 'MT-' || LPAD(next_num::text, 4, '0');
      WHILE EXISTS (SELECT 1 FROM public.machine_types WHERE display_code = candidate_code) LOOP
        next_num := next_num + 1;
        candidate_code := 'MT-' || LPAD(next_num::text, 4, '0');
      END LOOP;

      UPDATE public.machine_types
      SET display_code = candidate_code
      WHERE id = rec.id;

      next_num := next_num + 1;
    END LOOP;
  END IF;
END $$;
