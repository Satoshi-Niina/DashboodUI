/**
 * データベースのパスワードがハッシュ化されているか確認するスクリプト
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkPasswords() {
  try {
    console.log('データベースに接続中...');
    const query = 'SELECT username, password, LENGTH(password) as pass_length FROM master_data.users LIMIT 5';
    const result = await pool.query(query);
    
    console.log('\n=== Users テーブルのパスワード情報 ===\n');
    result.rows.forEach(row => {
      const isBcrypt = row.password.startsWith('$2b$') || row.password.startsWith('$2a$');
      console.log(`ユーザー名: ${row.username}`);
      console.log(`パスワード: ${row.password.substring(0, 20)}...`);
      console.log(`長さ: ${row.pass_length} 文字`);
      console.log(`形式: ${isBcrypt ? 'bcryptハッシュ ✅' : '平文またはその他 ❌'}`);
      console.log('---');
    });
    
    await pool.end();
  } catch (err) {
    console.error('エラー:', err.message);
    await pool.end();
    process.exit(1);
  }
}

checkPasswords();
