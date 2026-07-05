-- ========================================
-- マルチテナント案内板 初期設定（common_db用）
-- ========================================
-- 
-- 【目的】
-- 本番司令塔（common_db）にマルチテナント用のルーティング情報を登録
-- common_db への一元管理化を実現
-- 
-- 【対象DB】
-- common_db（本番環境）
-- 
-- 【実行方法】
-- psql -h 127.0.0.1 -p 5432 -U postgres -d common_db -f init-common-routing.sql
-- 
-- 【特徴】
-- - 冪等性保証: 何度実行しても安全（ON CONFLICT DO UPDATE使用）
-- - テナント別のDB接続先とストレージバケットを管理
-- - 各テナントの機能配置（マスターデータ）を管理
--
-- ========================================

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'common_db', // 司令塔DBを指定
  port: process.env.DB_PORT || 5432,
});

const sql = `
BEGIN;

-- 1. company_db_routing への登録（正しいカラム名とON CONFLICT仕様）
INSERT INTO public.company_db_routing (
    company_id, db_host, db_name, company_name, storage_bucket_name, tenant_path
) VALUES (
    'kintetsu',
    '/cloudsql/maint-vehicle-management:asia-northeast2:free-trial-first-project',
    'kintetsu_db',
    '近鉄テナント',
    'gcs-bucket-kintetsu',
    'kintetsu'
) ON CONFLICT (company_id) DO UPDATE 
SET 
    db_host = EXCLUDED.db_host,
    db_name = EXCLUDED.db_name,
    storage_bucket_name = EXCLUDED.storage_bucket_name,
    tenant_path = EXCLUDED.tenant_path;

-- 2. app_resource_routing への登録（logical_resource_name, physical_table_name に準拠）
INSERT INTO public.app_resource_routing (
    tenant_id, app_id, logical_resource_name, physical_schema, physical_table_name, is_active
) VALUES 
('kintetsu', 'dashboard-ui', 'users',             'master_data', 'users',             true),
('kintetsu', 'dashboard-ui', 'vehicles',          'master_data', 'vehicles',          true),
('kintetsu', 'dashboard-ui', 'ai_settings',       'master_data', 'ai_settings',       true),
('kintetsu', 'dashboard-ui', 'ai_knowledge_data', 'master_data', 'ai_knowledge_data', true)
ON CONFLICT (tenant_id, logical_resource_name) DO UPDATE 
SET 
    physical_schema = EXCLUDED.physical_schema,
    physical_table_name = EXCLUDED.physical_table_name,
    is_active = EXCLUDED.is_active;

COMMIT;
`;

async function main() {
  try {
    await client.connect();
    console.log('🔄 common_db への接続に成功しました。ルーティングデータを追加中...');
    await client.query(sql);
    console.log('✅ kintetsu テナントのルーティング設定が正常に登録されました。');
  } catch (err) {
    console.error('❌ エラーが発生したためロールバックしました。:', err.stack);
    try { await client.query('ROLLBACK;'); } catch (e) {}
  } finally {
    await client.end();
  }
}

main();