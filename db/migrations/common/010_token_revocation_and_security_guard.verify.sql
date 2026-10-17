SELECT
  to_regclass('public.revoked_tokens') IS NOT NULL
  AND to_regclass('public.revocation_rules') IS NOT NULL
  AND to_regclass('public.login_attempt_counters') IS NOT NULL
  AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_jwt_revocation')
  AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_current_token_generations')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revocation_rules' AND column_name = 'generation')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'login_attempt_counters' AND column_name = 'reset_generation')
  AS ok;
