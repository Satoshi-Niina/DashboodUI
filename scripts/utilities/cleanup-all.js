// 全てのナレッジデータを論理削除
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function cleanupAll() {
  try {
    console.log('=== 全データのクリーンアップ ===\n');
    
    // is_activeに関係なく全てのデータを論理削除
    const updateQuery = `
      UPDATE master_data.ai_knowledge_data
      SET is_active = false
      RETURNING id, file_name, gcs_chunks_path, uploaded_at
    `;
    
    const result = await pool.query(updateQuery);
    
    if (result.rows.length === 0) {
      console.log('✅ 更新対象のデータはありません');
    } else {
      console.log(`✅ ${result.rows.length}件のデータを論理削除しました:\n`);
      result.rows.forEach((row, index) => {
        console.log(`[${index + 1}] ID: ${row.id} - ${row.file_name}`);
      });
    }
    
    console.log('\n✅ 完全クリーンアップ完了！');
    console.log('新しいフォルダ構造（ai-knowledge/）でファイルを再インポートしてください。');
    
  } catch (err) {
    console.error('❌ エラー:', err.message);
  } finally {
    await pool.end();
  }
}

cleanupAll();
