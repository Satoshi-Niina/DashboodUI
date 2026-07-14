const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER || 'postgres',
  host: '127.0.0.1',
  database: 'common_db', // 確実に本番司令塔に接続
  password: process.env.DB_PASSWORD,
  port: 5432,
});

async function run() {
  try {
    await client.connect();
    console.log('[Connect] 本番の common_db（プロキシ経由）に接続成功しました。');

    const sqlPath = path.join(__dirname, 'init-common-routing.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('[Executing] init-common-routing.sql を実行中...');
    await client.query(sql);
    
    console.log('[Success] 🎉 common_db へのルーティング一元化データの登録が正常に完了しました！');
  } catch (err) {
    console.error('[Error] SQLの実行に失敗しました:', err);
  } finally {
    await client.end();
  }
}

run();