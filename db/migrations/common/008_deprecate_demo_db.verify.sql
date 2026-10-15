SELECT (
  (SELECT COUNT(*) FROM public.tenants WHERE tenant_key = 'demo' AND is_active = true) = 0
) AS ok;
