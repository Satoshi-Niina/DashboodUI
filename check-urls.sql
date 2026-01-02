-- 現在のURL設定を確認
SELECT config_key, config_value, description 
FROM master_data.config 
WHERE config_key LIKE 'app_url%'
ORDER BY config_key;
