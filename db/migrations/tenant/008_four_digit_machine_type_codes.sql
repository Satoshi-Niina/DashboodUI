DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.machine_types
    WHERE display_code IS NULL
       OR display_code !~ '^[0-9]+$'
       OR CASE
            WHEN display_code ~ '^[0-9]+$' THEN display_code::numeric > 9999
            ELSE false
          END
  ) THEN
    RAISE EXCEPTION 'machine_types.display_code contains a value that cannot be represented as a four-digit code';
  END IF;
END $$;

UPDATE public.machine_types
SET display_code = lpad(display_code, 4, '0')
WHERE length(display_code) < 4;
