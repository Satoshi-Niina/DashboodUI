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

module.exports = pool;
