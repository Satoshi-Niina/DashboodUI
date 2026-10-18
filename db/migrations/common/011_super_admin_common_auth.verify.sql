SELECT
  to_regclass('public.super_admins') IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.super_admins WHERE username = 'niina')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'is_super_admin')
  AND EXISTS (SELECT 1 FROM public.devices WHERE device_identifier = 'pc-superadmin-niina' AND is_super_admin = true)
  AS ok;
