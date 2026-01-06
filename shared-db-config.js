/**
 * 統一データベース接続設定
 * 各アプリケーションから使用する共通のDB接続設定
 * ローカル環境と本番環境（Cloud Run + Cloud SQL）の両方に対応
 */

const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// 本番環境（Cloud SQL）とローカル環境で接続設定を切り替え
const dbConfig = isProduction && process.env.CLOUD_SQL_INSTANCE ? {
  // 本番環境: Cloud SQL Unix socket接続
  host: `/cloudsql/${process.env.CLOUD_SQL_INSTANCE}`,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'webappdb',
  max: 5,
} : {
  // ローカル環境: 接続文字列を使用
  connectionString: process.env.DATABASE_URL,
};

const pool = new Pool(dbConfig);

// 接続エラーハンドリング
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// 接続確立時にsearch_pathを設定（本番環境対応）
pool.on('connect', (client) => {
  client.query('SET search_path TO master_data, public', (err) => {
    if (err) {
      console.error('Failed to set search_path:', err);
    } else {
      console.log('✅ search_path set to: master_data, public');
    }
  });
});

console.log('📊 Database Pool Configuration:');
console.log('  - Environment:', isProduction ? 'PRODUCTION' : 'LOCAL');
console.log('  - Connection:', isProduction ? 'Cloud SQL Unix Socket' : 'TCP Connection');
if (isProduction) {
  console.log('  - Socket Path:', `/cloudsql/${process.env.CLOUD_SQL_INSTANCE}`);
  console.log('  - Database:', process.env.DB_NAME || 'webappdb');
  console.log('  - User:', process.env.DB_USER);
} else {
  console.log('  - Connection String:', dbConfig.connectionString ? 'Configured' : 'Not Set');
}

module.exports = pool;
