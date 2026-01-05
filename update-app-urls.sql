-- ========================================
-- 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳURL譖ｴ譁ｰ繧ｹ繧ｯ繝ｪ繝励ヨ
-- Cloud SQL縺ｮGoogle Cloud Console繧ｯ繧ｨ繝ｪ繧ｨ繝・ぅ繧ｿ縺ｧ螳溯｡後＠縺ｦ縺上□縺輔＞
-- ========================================

-- 蠢懈･蠕ｩ譌ｧ謾ｯ謠ｴ繧ｷ繧ｹ繝・Β縺ｮURL繧呈ｭ｣縺励＞URL縺ｫ譖ｴ譁ｰ
UPDATE master_data.app_config
SET config_value = 'https://emergency-client-u3tejuflja-dt.a.run.app/',
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'app_url_emergency';

-- 莉悶・繧｢繝励Μ(譛ｪ繝・・繝ｭ繧､)縺ｯ貅門ｙ荳ｭ縺ｫ譖ｴ譁ｰ
UPDATE master_data.app_config
SET config_value = 'https://貅門ｙ荳ｭ',
    description = '險育判繝ｻ螳溽ｸｾ邂｡逅・す繧ｹ繝・ΒURL・域ｺ門ｙ荳ｭ・・,
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'app_url_planning';

UPDATE master_data.app_config
SET config_value = 'https://貅門ｙ荳ｭ',
    description = '菫晏ｮ育畑霆顔ｮ｡逅・す繧ｹ繝・ΒURL・域ｺ門ｙ荳ｭ・・,
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'app_url_equipment';

UPDATE master_data.app_config
SET config_value = 'https://貅門ｙ荳ｭ',
    description = '讖滓｢ｰ謨・囿邂｡逅・す繧ｹ繝・ΒURL・域ｺ門ｙ荳ｭ・・,
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'app_url_failure';

-- 譖ｴ譁ｰ邨先棡繧堤｢ｺ隱・
SELECT config_key, config_value, description, updated_at
FROM master_data.app_config
WHERE config_key LIKE 'app_url_%'
ORDER BY config_key;
