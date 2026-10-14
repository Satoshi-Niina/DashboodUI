DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.machine_types
    WHERE display_code IS NULL
       OR display_code !~ '^(MT-)?[0-9]{1,4}$'
       OR CASE
            WHEN display_code ~ '^(MT-)?[0-9]{1,4}$'
              THEN substring(display_code FROM '[0-9]+$')::integer NOT BETWEEN 1 AND 9999
            ELSE false
          END
  ) THEN
    RAISE EXCEPTION 'machine_types.display_code contains a value outside the MT-0001 to MT-9999 range';
  END IF;

  IF EXISTS (
    SELECT normalized_code
    FROM (
      SELECT
        'MT-' || lpad(substring(display_code FROM '[0-9]+$'), 4, '0') AS normalized_code
      FROM public.machine_types
    ) AS codes
    GROUP BY normalized_code
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'machine_types.display_code values collide after adding the MT- prefix';
  END IF;
END $$;

UPDATE public.machine_types
SET display_code = 'MT-' || lpad(substring(display_code FROM '[0-9]+$'), 4, '0');
