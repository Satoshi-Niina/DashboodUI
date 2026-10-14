-- Public tenant ID lifecycle: >=128-bit random IDs, retire/rotate without reuse.
-- 004 generated IDs from the first 24 hex characters of a UUIDv4. That slice contains the fixed
-- version nibble, so it carries only 92 random bits. Such IDs are retired and replaced below.

-- 120 random bits from one UUIDv4 (fixed version/variant nibbles removed); two UUIDs give 36 hex chars (144 bits).
CREATE OR REPLACE FUNCTION public.generate_tenant_public_id() RETURNS text AS $$
DECLARE
  a text := replace(gen_random_uuid()::text, '-', '');
  b text := replace(gen_random_uuid()::text, '-', '');
BEGIN
  RETURN 't' || substr(a, 1, 12) || substr(a, 14, 3) || substr(a, 18, 15) || substr(substr(b, 1, 12) || substr(b, 14, 3), 1, 6);
END;
$$ LANGUAGE plpgsql VOLATILE;

ALTER TABLE public.tenant_public_ids ADD COLUMN IF NOT EXISTS id bigint GENERATED ALWAYS AS IDENTITY;
ALTER TABLE public.tenant_public_ids ADD COLUMN IF NOT EXISTS retired_at timestamptz;
ALTER TABLE public.tenant_public_ids ADD COLUMN IF NOT EXISTS retired_reason text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenant_public_ids'::regclass AND contype = 'p'
      AND conname = 'tenant_public_ids_pkey'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (tenant_key)'
  ) THEN
    ALTER TABLE public.tenant_public_ids DROP CONSTRAINT tenant_public_ids_pkey;
    ALTER TABLE public.tenant_public_ids ADD CONSTRAINT tenant_public_ids_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- One active public ID per tenant; retired IDs stay in the table so they are never reissued.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_public_ids_one_active_idx
  ON public.tenant_public_ids (tenant_key) WHERE is_active;

CREATE OR REPLACE FUNCTION public.tenant_public_ids_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_key IS DISTINCT FROM OLD.tenant_key OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'tenant_public_ids.tenant_key and public_id are immutable';
  END IF;
  IF OLD.is_active = false AND NEW.is_active = true THEN
    RAISE EXCEPTION 'A retired public tenant ID cannot be reactivated; issue a new one';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.tenant_public_ids_strength() RETURNS trigger AS $$
BEGIN
  IF length(NEW.public_id) < 33 THEN
    RAISE EXCEPTION 'public tenant IDs must carry at least 128 random bits (33+ characters)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_public_ids_strength_trg ON public.tenant_public_ids;
CREATE TRIGGER tenant_public_ids_strength_trg
  BEFORE INSERT ON public.tenant_public_ids
  FOR EACH ROW EXECUTE FUNCTION public.tenant_public_ids_strength();

-- Retire weak IDs from 004 and issue strong replacements (one active ID per tenant).
WITH weak AS (
  UPDATE public.tenant_public_ids
     SET is_active = false,
         retired_at = now(),
         retired_reason = 'rotated: below 128-bit entropy'
   WHERE is_active AND length(public_id) < 33
  RETURNING tenant_key
)
INSERT INTO public.tenant_public_ids (tenant_key, public_id)
SELECT tenant_key, public.generate_tenant_public_id() FROM weak;
