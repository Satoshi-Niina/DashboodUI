-- Public tenant IDs are random URL identifiers, separate from internal tenant_key.
-- Existing IDs are never regenerated: rows are only added for tenants that lack one.
CREATE TABLE IF NOT EXISTS public.tenant_public_ids (
  tenant_key varchar(100) PRIMARY KEY,
  public_id varchar(64) NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_public_ids_format_chk CHECK (public_id ~ '^[a-z0-9]{16,64}$')
);

CREATE OR REPLACE FUNCTION public.tenant_public_ids_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_key IS DISTINCT FROM OLD.tenant_key OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'tenant_public_ids.tenant_key and public_id are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_public_ids_immutable_trg ON public.tenant_public_ids;
CREATE TRIGGER tenant_public_ids_immutable_trg
  BEFORE UPDATE ON public.tenant_public_ids
  FOR EACH ROW EXECUTE FUNCTION public.tenant_public_ids_immutable();

INSERT INTO public.tenant_public_ids (tenant_key, public_id)
SELECT routes.tenant_key, 't' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
FROM (
  SELECT DISTINCT tenant_key
  FROM public.tenant_app_routings
  WHERE tenant_key IS NOT NULL AND tenant_key <> ''
) routes
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_public_ids existing WHERE existing.tenant_key = routes.tenant_key
);