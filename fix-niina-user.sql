-- ========================================
-- ログイン問題修正用SQLスクリプト
-- Cloud SQLコンソールで実行してください
-- ========================================

-- 1. 現在のusersテーブルの状態を確認
SELECT 
    id,
    username,
    display_name,
    email,
    role,
    created_at,
    LEFT(password, 10) as password_preview  -- セキュリティのため最初の10文字のみ表示
FROM master_data.users
ORDER BY id;

-- 2. niinaユーザーが存在するか確認
SELECT COUNT(*) as niina_exists 
FROM master_data.users 
WHERE username = 'niina';

-- 3. niinaユーザーが存在しない場合は作成（既に存在する場合はスキップ）
-- パスワード: G&896845
INSERT INTO master_data.users (username, password, display_name, email, role)
VALUES ('niina', '$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq', '新名 諭', 'niina@example.com', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 4. niinaユーザーが存在するがパスワードが違う場合は更新
UPDATE master_data.users 
SET 
    password = '$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq',
    role = 'admin',
    display_name = '新名 諭',
    updated_at = CURRENT_TIMESTAMP
WHERE username = 'niina';

-- 5. 更新後の確認
SELECT 
    id,
    username,
    display_name,
    email,
    role,
    created_at,
    updated_at,
    LEFT(password, 10) as password_preview
FROM master_data.users
WHERE username = 'niina';

-- ========================================
-- 確認用クエリ
-- ========================================

-- すべてのユーザーを確認
-- SELECT * FROM master_data.users;

-- ユーザー数を確認
-- SELECT COUNT(*) as total_users FROM master_data.users;

-- スキーマを確認
-- SELECT table_schema, table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'master_data';
