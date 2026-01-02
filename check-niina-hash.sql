-- ========================================
-- niinaユーザーのパスワードハッシュ確認用SQL
-- Cloud SQLコンソールで実行してください
-- ========================================

-- 現在登録されているniinaユーザーの情報を表示
SELECT 
    id,
    username,
    display_name,
    role,
    email,
    created_at,
    updated_at,
    password as current_password_hash
FROM master_data.users 
WHERE username = 'niina';

-- ハッシュの最初の30文字だけ表示（確認用）
SELECT 
    username,
    LEFT(password, 30) as hash_first_30_chars,
    LENGTH(password) as hash_length,
    role
FROM master_data.users 
WHERE username = 'niina';

-- 期待される値:
-- hash_first_30_chars: $2b$10$BiKD0cFkIZfpxPlfwu6wTe
-- hash_length: 60
-- role: admin

-- もしハッシュが違う場合、以下で正しいハッシュに更新:
-- UPDATE master_data.users 
-- SET password = '$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq',
--     role = 'admin',
--     updated_at = CURRENT_TIMESTAMP
-- WHERE username = 'niina';

-- 更新後、再度確認:
-- SELECT username, LEFT(password, 30), role FROM master_data.users WHERE username = 'niina';
