SELECT
  to_regclass('public.tenant_public_ids') IS NOT NULL
  AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tenant_public_ids_immutable_trg' AND NOT tgisinternal)
  AS ok;