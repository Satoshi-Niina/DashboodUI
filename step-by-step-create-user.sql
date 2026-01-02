-- ========================================
-- ステップ1: スキーマとテーブルの存在確認
-- ========================================

-- 1. master_dataスキーマが存在するか確認
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'master_data';

-- 2. usersテーブルが存在するか確認
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema = 'master_data' 
  AND table_name = 'users';

-- 3. もしテーブルが存在する場合、全ユーザーを表示
SELECT * FROM master_data.users;

-- 4. もしテーブルが存在しない場合、publicスキーマを確認
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name = 'users';

-- ========================================
-- ステップ2: テーブルが存在しない場合の対処
-- ========================================
-- 以下のコメントを外して実行してください

-- master_dataスキーマを作成
-- CREATE SCHEMA IF NOT EXISTS master_data;

-- usersテーブルを作成
-- CREATE TABLE IF NOT EXISTS master_data.users (
--     id SERIAL PRIMARY KEY,
--     username VARCHAR(50) UNIQUE NOT NULL,
--     password VARCHAR(255) NOT NULL,
--     display_name VARCHAR(100),
--     email VARCHAR(100),
--     role VARCHAR(20) DEFAULT 'user',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- ========================================
-- ステップ3: niinaユーザーを作成
-- ========================================
-- テーブルが存在することを確認したら実行

-- INSERT INTO master_data.users (username, password, display_name, email, role)
-- VALUES (
--   'niina', 
--   '$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq', 
--   '新名 諭', 
--   'niina@example.com', 
--   'admin'
-- )
-- ON CONFLICT (username) DO NOTHING;

-- ========================================
-- ステップ4: 作成後の確認
-- ========================================

-- SELECT id, username, display_name, role, LEFT(password, 30) as hash_preview
-- FROM master_data.users 
-- WHERE username = 'niina';
