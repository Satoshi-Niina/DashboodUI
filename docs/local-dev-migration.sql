-- このファイルに接続URL、パスワード、JWT、APIキーを記載しないこと。
-- DB接続は DATABASE_URL 等のGit管理外環境変数から行うこと。
-- ローカル動作確認用: common_db.tenant_app_routings を現行 server.js の想定スキーマに合わせる
ALTER TABLE public.tenant_app_routings
  ADD COLUMN IF NOT EXISTS database_url text,
  ADD COLUMN IF NOT EXISTS app_name varchar(255),
  ADD COLUMN IF NOT EXISTS app_url varchar(1024),
  ADD COLUMN IF NOT EXISTS icon varchar(50),
  ADD COLUMN IF NOT EXISTS icon_class varchar(100),
  ADD COLUMN IF NOT EXISTS category varchar(100),
  ADD COLUMN IF NOT EXISTS required_role varchar(50),
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.tenant_app_routings
SET database_url = tenant_db_connection_string
WHERE database_url IS NULL;

-- (tenant_key) 単独PKでは1テナント1アプリしか登録できないため複合PKへ変更
ALTER TABLE public.tenant_app_routings DROP CONSTRAINT IF EXISTS tenant_app_routings_pkey;
ALTER TABLE public.tenant_app_routings ADD PRIMARY KEY (tenant_key, app_id);

-- この旧ルーティング形式では database_url を新規登録しないこと。
-- 20260903_common_db_foundation_up.sql の tenant_db_routing.database_key を使用すること。
INSERT INTO public.tenant_app_routings
  (tenant_key, app_id, tenant_id, tenant_name, database_url, app_name, app_url, icon, category, display_order, is_visible, is_active, description)
VALUES
  ('demo', 'vehicle', 'demo', 'デモ環境', NULL, '保守用車管理', 'http://localhost:3001', '🚛', '運用管理', 1, true, true, '保守用車の運用状況を管理します'),
  ('demo', 'inspection', 'demo', 'デモ環境', NULL, '検修管理', 'http://localhost:3002', '🔧', '運用管理', 2, true, true, '検修スケジュールを管理します'),
  ('demo', 'kosei', 'demo', 'デモ環境', NULL, '工事管理', 'http://localhost:3003', '🏗️', '運用管理', 3, true, true, '工事情報を管理します'),
  ('demo', 'troubleshoot', 'demo', 'デモ環境', NULL, '故障診断', 'http://localhost:3004', '🚨', '保守支援', 4, true, true, '故障時のトラブルシューティングを支援します')
ON CONFLICT (tenant_key, app_id) DO NOTHING;
