ALTER TABLE public.machine_types
  ADD COLUMN IF NOT EXISTS display_code varchar(50);

WITH numbered_types AS (
  SELECT
    id,
    row_number() OVER (ORDER BY id::text) AS code_number
  FROM public.machine_types
)
UPDATE public.machine_types AS machine_type
SET display_code = 'MT-' || lpad(
  numbered_types.code_number::text,
  GREATEST(4, length(numbered_types.code_number::text)),
  '0'
)
FROM numbered_types
WHERE machine_type.id = numbered_types.id;

CREATE UNIQUE INDEX IF NOT EXISTS machine_types_display_code_uidx
  ON public.machine_types (display_code);
