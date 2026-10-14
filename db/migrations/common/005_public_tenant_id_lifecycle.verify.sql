SELECT
  to_regprocedure('public.generate_tenant_public_id()') IS NOT NULL
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_public_ids' AND column_name = 'retired_at')
  AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'tenant_public_ids_one_active_idx')
  AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tenant_public_ids_strength_trg' AND NOT tgisinternal)
  AND NOT EXISTS (SELECT 1 FROM public.tenant_public_ids WHERE is_active AND length(public_id) < 33)
  AS ok;
