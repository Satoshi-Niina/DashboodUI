-- niina繝ｦ繝ｼ繧ｶ繝ｼ繧偵す繧ｹ繝・Β邂｡逅・・↓險ｭ螳・
UPDATE master_data.users 
SET role = 'system_admin', display_name = '譁ｰ邏・譎ｺ蠢・, email = NULL, updated_at = CURRENT_TIMESTAMP
WHERE username = 'niina';

-- 遒ｺ隱・
SELECT id, username, role, display_name, email 
FROM master_data.users 
WHERE username = 'niina';
