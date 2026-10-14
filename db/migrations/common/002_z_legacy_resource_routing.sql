DO $$
DECLARE
  legacy_shape boolean := false;
  primary_key_name text;
BEGIN
  IF to_regclass('public.app_resource_routing') IS NULL THEN
    RETURN;
  END IF;

  SELECT
    (SELECT count(*) = 4
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'app_resource_routing'
       AND column_name IN ('tenant_key', 'tenant_name', 'org_id', 'database_url'))
    AND EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = to_regclass('public.app_resource_routing')
        AND contype = 'p'
        AND pg_get_constraintdef(oid) = 'PRIMARY KEY (tenant_key)'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_resource_routing' AND column_name = 'tenant_name'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_resource_routing' AND column_name = 'org_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_resource_routing' AND column_name = 'database_url'
    )
  INTO legacy_shape;

  IF legacy_shape THEN
    IF to_regclass('public.app_resource_routing_legacy') IS NOT NULL THEN
      RAISE EXCEPTION 'Both legacy and current app_resource_routing tables exist; inspect before continuing';
    END IF;

    SELECT conname INTO primary_key_name
    FROM pg_constraint
    WHERE conrelid = to_regclass('public.app_resource_routing')
      AND contype = 'p';

    EXECUTE format(
      'ALTER TABLE public.app_resource_routing RENAME CONSTRAINT %I TO app_resource_routing_legacy_pkey',
      primary_key_name
    );
    ALTER TABLE public.app_resource_routing RENAME TO app_resource_routing_legacy;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.app_resource_routing (
  app_id varchar(100) NOT NULL,
  logical_resource_name varchar(255) NOT NULL,
  physical_schema varchar(255) NOT NULL,
  physical_table varchar(255) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (app_id, logical_resource_name)
);
