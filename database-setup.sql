-- アプリケーション設定を保存するテーブル
CREATE TABLE IF NOT EXISTS master_data.app_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初期データの挿入
INSERT INTO master_data.app_config (config_key, config_value, description) 
VALUES 
    ('app_url_emergency', 'https://emergency-client-u3tejuflja-dt.a.run.app', '応急復旧支援システムURL'),
    ('app_url_planning', 'http://localhost:3002', '計画・実績管理システムURL'),
    ('app_url_equipment', 'http://localhost:3003', '保守用車管理システムURL'),
    ('app_url_failure', 'http://localhost:3004', '機械故障管理システムURL'),
    ('cors_origin', '*', 'CORS許可オリジン')
ON CONFLICT (config_key) DO NOTHING;

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_app_config_key ON master_data.app_config(config_key);
CREATE INDEX IF NOT EXISTS idx_app_config_updated_at ON master_data.app_config(updated_at DESC);

-- 設定変更履歴テーブル（オプション）
CREATE TABLE IF NOT EXISTS master_data.app_config_history (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_config_history_key ON master_data.app_config_history(config_key);
CREATE INDEX IF NOT EXISTS idx_config_history_updated_at ON master_data.app_config_history(updated_at DESC);

-- usersテーブルにupdated_atカラムを追加（既存テーブルの場合）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'master_data' 
        AND table_name = 'users' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE master_data.users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- usersテーブルのcreated_atカラムを追加（既存テーブルの場合）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'master_data' 
        AND table_name = 'users' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE master_data.users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- サンプルクエリ: すべての設定を取得
-- SELECT config_key, config_value FROM master_data.app_config;

-- サンプルクエリ: 特定の設定を更新
-- UPDATE master_data.app_config 
-- SET config_value = 'https://new-url.com', 
--     updated_by = 'admin', 
--     updated_at = CURRENT_TIMESTAMP 
-- WHERE config_key = 'app_url_emergency';
