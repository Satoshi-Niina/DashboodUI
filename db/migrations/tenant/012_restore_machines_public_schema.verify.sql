SELECT
  to_regclass('public.machine_types') IS NOT NULL
  AND to_regclass('public.machines') IS NOT NULL
  AND to_regclass('master_data.machines') IS NOT NULL
  AS ok;
