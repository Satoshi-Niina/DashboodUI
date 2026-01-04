-- niinaユーザーをシステム管理者に設定
UPDATE master_data.users 
SET role = 'system_admin', display_name = '新納 智志', email = NULL, updated_at = CURRENT_TIMESTAMP
WHERE username = 'niina';

-- 確認
SELECT id, username, role, display_name, email 
FROM master_data.users 
WHERE username = 'niina';
