// テーブル構造を確認するスクリプト
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTableStructure() {
  try {
    console.log('=== テーブル構造を確認中 ===\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'master_data'
        AND table_name = 'ai_knowledge_data'
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ master_data.ai_knowledge_dataテーブルが見つかりません。');
    } else {
      console.log('✅ カラム一覧:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type}, NULL: ${row.is_nullable})`);
      });
    }
    
  } catch (err) {
    console.error('❌ エラーが発生しました:', err.message);
  } finally {
    await pool.end();
  }
}

checkTableStructure();
