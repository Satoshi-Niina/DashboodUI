-- app_url_failureを更新（準備中に変更）
UPDATE master_data.config 
SET config_value = 'https://準備中', 
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'app_url_failure';

-- 確認
SELECT config_key, config_value, description 
FROM master_data.config 
WHERE config_key = 'app_url_failure';
