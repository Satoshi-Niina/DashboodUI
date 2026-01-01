-- ========================================
-- アプリケーションURL更新スクリプト
-- Cloud SQLのGoogle Cloud Consoleクエリエディタで実行してください
-- ========================================

-- 応急復旧支援システムのURLを正しいURLに更新
UPDATE master_data.app_config
SET config_value = 'https://emergency-client-u3tejuflja-dt.a.run.app/',
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'app_url_emergency';

-- 他のアプリ(未デプロイ)は準備中に更新
UPDATE master_data.app_config
SET config_value = 'https://準備中',
    description = '計画・実績管理システムURL（準備中）',
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'app_url_planning';

UPDATE master_data.app_config
SET config_value = 'https://準備中',
    description = '保守用車管理システムURL（準備中）',
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'app_url_equipment';

UPDATE master_data.app_config
SET config_value = 'https://準備中',
    description = '機械故障管理システムURL（準備中）',
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'app_url_failure';

-- 更新結果を確認
SELECT config_key, config_value, description, updated_at
FROM master_data.app_config
WHERE config_key LIKE 'app_url_%'
ORDER BY config_key;
