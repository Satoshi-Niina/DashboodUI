-- 006_reorganize_common_db_control_plane.sql
-- common_db 制御プレーンの整理と強化
-- 目標構成:
-- 1. 公開テナントIDと内部テナントの対応 (tenants, tenant_public_ids)
-- 2. テナントDBへの接続先管理 (tenant_db_routing)
-- 3. アプリ一覧、起動先、テナントごとの利用可否 (applications, tenant_applications)
-- 4. システム全体に必要な設定 (app_config)
-- 5. common_db自身のマイグレーション履歴 (dashboard_schema_migrations)

-- 1. システム全体設定テーブルの作成 (存在しない場合)
CREATE TABLE IF NOT EXISTS public.app_config (
  config_key varchar(100) PRIMARY KEY,
  config_value text NOT NULL
);

-- 既存テーブルがある場合に備えて列を安全に追加
ALTER TABLE public.app_config ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.app_config ADD COLUMN IF NOT EXISTS is_encrypted boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_config ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.app_config ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. システム全体設定の初期シード (冪等)
INSERT INTO public.app_config (config_key, config_value, description)
VALUES 
  ('system_name', '保守用車管理マルチテナントシステム', 'システム名称'),
  ('auth_mode', 'tenant_db_isolated', '認証モード: テナントDB完全分離認証'),
  ('session_timeout_seconds', '14400', 'セッション有効期間(秒)')
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = now();

-- 3. tenant_db_routing のインデックス強化
CREATE INDEX IF NOT EXISTS idx_tenant_db_routing_lookup
  ON public.tenant_db_routing (tenant_id, is_active);

-- 4. tenant_applications のインデックス強化
CREATE INDEX IF NOT EXISTS idx_tenant_apps_enabled
  ON public.tenant_applications (tenant_id, is_enabled, is_visible);

-- 5. 旧ルーティングテーブル (tenant_app_routings) の役割整理
COMMENT ON TABLE public.tenant_app_routings IS '非推奨（段階的移行中）: 今後は tenant_db_routing + tenant_applications + applications を使用';
