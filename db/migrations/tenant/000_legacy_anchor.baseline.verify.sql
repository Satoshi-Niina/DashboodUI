SELECT
  to_regclass('public.users') IS NOT NULL
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id' AND data_type = 'uuid')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username')
  AS ok;
