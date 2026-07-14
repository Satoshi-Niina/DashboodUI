const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER || 'postgres',
  host: '127.0.0.1',
  database: 'common_db',
  password: process.env.DB_PASSWORD || 'Takabeni',
  port: 5432,
});

async function run() {
  try {
    await client.connect();
    console.log('[Connect] データベースに接続成功しました。');

    const result = await client.query('SELECT id, username, display_name, email, role FROM master_data.users ORDER BY id');
    console.log('\n=== 登録ユーザー一覧 ===');
    console.table(result.rows);
    
  } catch (err) {
    console.error('[Error] データベース接続またはクエリ実行に失敗しました:', err.message);
  } finally {
    await client.end();
  }
}

run();
