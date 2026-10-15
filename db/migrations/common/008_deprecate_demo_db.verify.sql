SELECT (
  (SELECT COUNT(*) FROM public.tenant_app_routings WHERE (tenant_key = 'demo' OR db_name = 'demo_db') AND is_active = true) = 0
  AND
  (SELECT COUNT(*) FROM public.tenants WHERE tenant_key = 'demo' AND is_active = true) = 0
) AS ok;
