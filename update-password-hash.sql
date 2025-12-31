-- 既存ユーザーのパスワードをbcryptハッシュに更新する
-- このSQLはCloud Shellまたはローカルから実行してください

-- パスワード 'password123' のハッシュ例
-- bcryptでハッシュ化されたパスワード (rounds=10)
-- 実際には、Node.jsで生成してください:
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('your_password', 10);
-- console.log(hash);

-- 例: adminユーザーのパスワードを更新
-- パスワード 'admin123' のハッシュ: $2b$10$XYZ... (実際のハッシュに置き換え)

-- テスト用にハッシュを生成するNode.jsコマンド:
-- node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(hash => console.log(hash));"

-- UPDATE例（ハッシュを生成してから実行）:
-- UPDATE master_data.users 
-- SET password = '$2b$10$実際のハッシュ値' 
-- WHERE username = 'admin';

-- または、新しいテストユーザーを追加:
-- INSERT INTO master_data.users (username, password, display_name)
-- VALUES ('testuser', '$2b$10$実際のハッシュ値', 'テストユーザー');
