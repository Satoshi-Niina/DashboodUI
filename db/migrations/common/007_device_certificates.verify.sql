SELECT
  to_regclass('public.devices') IS NOT NULL
  AND to_regclass('public.device_certificates') IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.devices WHERE device_identifier = 'ipad-daitetsu-001')
  AND EXISTS (SELECT 1 FROM public.device_certificates WHERE fingerprint256 = '017bdb02011d8933801e14b14b3a216efe34cb9da8450d6b79448e196a67574e')
  AS ok;
