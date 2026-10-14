WITH numbered_types AS (
  SELECT
    id,
    row_number() OVER (ORDER BY id::text) AS code_number
  FROM public.machine_types
)
UPDATE public.machine_types AS machine_type
SET display_code = numbered_types.code_number::text
FROM numbered_types
WHERE machine_type.id = numbered_types.id;
