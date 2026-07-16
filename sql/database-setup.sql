-- ========================================
-- 統一データベースセットアップスクリプト
-- 既存クラウドDB構造対応版
-- common_db用（既存スキーマ・テーブルに合わせる）
-- ========================================

-- スキーマ作成（既に存在する場合はスキップ）
CREATE SCHEMA IF NOT EXISTS master_data;
CREATE SCHEMA IF NOT EXISTS maintenance;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS inspections;
CREATE SCHEMA IF NOT EXISTS emergency;
CREATE SCHEMA IF NOT EXISTS google_vacuum_mgmt;

-- ========================================
-- master_data スキーマの非移行テーブル
-- ========================================

-- 保守用車マスタ（業務テーブル移行対象外の既存テーブル）
CREATE TABLE IF NOT EXISTS master_data.vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    machine_id INTEGER,
    office_id INTEGER,
    model VARCHAR(50),
    registration_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 車両タイプマスタ（既存）
CREATE TABLE IF NOT EXISTS master_data.vehicle_types (
    type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ベース文書（既存）
CREATE TABLE IF NOT EXISTS master_data.base_documents (
    document_id SERIAL PRIMARY KEY,
    base_id INTEGER,
    document_name VARCHAR(200),
    file_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- チャット履歴（既存）
CREATE TABLE IF NOT EXISTS master_data.chat_history (
    chat_id SERIAL PRIMARY KEY,
    user_id INTEGER,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- アプリケーション設定（ダッシュボード用に追加）
CREATE TABLE IF NOT EXISTS master_data.app_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER
);

-- 設定変更履歴（ダッシュボード用に追加）
CREATE TABLE IF NOT EXISTS master_data.app_config_history (
    history_id SERIAL PRIMARY KEY,
    config_key VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- operations スキーマ（既存構造に合わせる）
-- ========================================

-- 運転計画（既存構造を想定）
CREATE TABLE IF NOT EXISTS operations.schedules (
    schedule_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER,
    schedule_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 運用実績
CREATE TABLE IF NOT EXISTS operations.operation_records (
    record_id SERIAL PRIMARY KEY,
    schedule_id INTEGER,
    vehicle_id INTEGER,
    operation_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    status VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- maintenance スキーマ（既存構造に合わせる）
-- ========================================

-- 故障記録
CREATE TABLE IF NOT EXISTS maintenance.fault_records (
    fault_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER,
    fault_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- inspections スキーマ
-- ========================================

-- 点検記録
CREATE TABLE IF NOT EXISTS inspections.inspection_records (
    inspection_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER,
    inspection_date DATE NOT NULL,
    inspector VARCHAR(100),
    inspection_type_id INTEGER,
    result VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- emergency スキーマ
-- ========================================

-- 応急復旧記録
CREATE TABLE IF NOT EXISTS emergency.emergency_records (
    emergency_id SERIAL PRIMARY KEY,
    incident_date TIMESTAMP NOT NULL,
    location VARCHAR(200),
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    assigned_to INTEGER,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 初期データ投入
-- ========================================

-- デフォルトCORS設定
INSERT INTO master_data.app_config (config_key, config_value, description)
VALUES 
    ('cors_origin', '*', 'CORS許可オリジン設定（開発環境用）'),
    ('app_url_emergency', 'https://emergency-client-800711608362.asia-northeast2.run.app', '応急復旧支援システムURL'),
    ('app_url_planning', 'https://railway-client-800711608362.asia-northeast2.run.app', '計画・実績管理システムURL'),
    ('app_url_equipment', 'https://operation-management-client-800711608362.asia-northeast2.run.app', '保守用車管理システムURL'),
    ('app_url_failure', 'https://machine-failure-client-800711608362.asia-northeast2.run.app', '機械故障管理システムURL')
ON CONFLICT (config_key) DO NOTHING;

-- ========================================
-- インデックス作成（パフォーマンス最適化）
-- ========================================

-- public業務テーブルのインデックスは init-business-tables.sql で管理する
CREATE INDEX IF NOT EXISTS idx_vehicles_number ON master_data.vehicles(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON master_data.vehicles(status);

-- operations スキーマ
CREATE INDEX IF NOT EXISTS idx_schedules_vehicle ON operations.schedules(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON operations.schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON operations.schedules(status);

-- maintenance スキーマ
CREATE INDEX IF NOT EXISTS idx_fault_records_vehicle ON maintenance.fault_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fault_records_date ON maintenance.fault_records(fault_date);
CREATE INDEX IF NOT EXISTS idx_fault_records_status ON maintenance.fault_records(status);

-- inspections スキーマ
CREATE INDEX IF NOT EXISTS idx_inspections_vehicle ON inspections.inspection_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections.inspection_records(inspection_date);

-- ========================================
-- 完了メッセージ
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'データベースセットアップ完了！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '既存クラウドDB構造に対応';
    RAISE NOTICE 'スキーマ: master_data, maintenance, operations, inspections, emergency';
    RAISE NOTICE '主要テーブル:';
    RAISE NOTICE '  - public.management_offices (事業所)';
    RAISE NOTICE '  - public.bases (保守基地)';
    RAISE NOTICE '  - master_data.vehicles (保守用車)';
    RAISE NOTICE '  - public.machine_types (機種マスタ)';
    RAISE NOTICE '  - public.machines (機械番号マスタ)';
    RAISE NOTICE '  - public.users (ユーザー)';
    RAISE NOTICE '========================================';
END $$;

