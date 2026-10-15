-- 008_deprecate_demo_db.sql
-- demo_db の廃止対応: demo テナントのルーティング、テナント登録、端末証明書を無効化する

UPDATE public.tenant_app_routings
SET is_active = false
WHERE tenant_key = 'demo' OR db_name = 'demo_db';

UPDATE public.tenants
SET is_active = false
WHERE tenant_key = 'demo';

UPDATE public.devices
SET is_active = false
WHERE tenant_id = 'demo' OR device_identifier = 'ipad-demo-001';

UPDATE public.device_certificates
SET is_revoked = true
WHERE device_id IN (
  SELECT id FROM public.devices WHERE tenant_id = 'demo' OR device_identifier = 'ipad-demo-001'
);
