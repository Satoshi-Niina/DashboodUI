-- demo_db ユーザー初期化スクリプト
-- こ このスクリプトを実行して demo_db にユーザーデータを設定します

-- 既存データを削除（テスト用）
DELETE FROM public.users WHERE username IN ('niina', 'demo_user', 'admin');

-- デモユーザーを挿入
-- パスワード: demo123 (平文で保存、ログイン時にハッシュ化される)
INSERT INTO public.users (username, password, display_name, role) VALUES 
('niina', 'demo123', '新井二郎', 'admin'),
('demo_user', 'demo123', 'デモユーザー', 'user'),
('admin', 'admin123', '管理者', 'admin')
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role;

-- 確認
SELECT id, username, password, display_name, role FROM public.users ORDER BY id;
