// 既存データを削除して新しいフォルダ構造に移行
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function cleanupOldData() {
  try {
    console.log('=== 既存データのクリーンアップ ===\n');
    
    // 1. 既存のナレッジデータを全て論理削除
    const updateQuery = `
      UPDATE master_data.ai_knowledge_data
      SET is_active = false
      WHERE is_active = true
      RETURNING id, file_name, gcs_original_path, gcs_chunks_path
    `;
    
    const result = await pool.query(updateQuery);
    
    if (result.rows.length === 0) {
      console.log('✅ 削除対象のデータはありません');
    } else {
      console.log(`✅ ${result.rows.length}件のデータを論理削除しました:\n`);
      result.rows.forEach((row, index) => {
        console.log(`[${index + 1}] ID: ${row.id}`);
        console.log(`    ファイル名: ${row.file_name}`);
        console.log(`    元ファイルパス: ${row.gcs_original_path || '（なし）'}`);
        console.log(`    チャンクパス: ${row.gcs_chunks_path || '（なし）'}`);
        console.log('');
      });
    }
    
    // 2. 設定確認
    console.log('\n=== 新しい保存先設定 ===');
    console.log(`GCSバケット: ${process.env.GOOGLE_CLOUD_STORAGE_BUCKET}`);
    console.log(`新しいフォルダ: ai-knowledge/`);
    console.log(`  - 画像: ai-knowledge/images/`);
    console.log(`  - 文書: ai-knowledge/manuals/`);
    console.log(`  - その他: ai-knowledge/originals/`);
    console.log(`  - チャンク: ai-knowledge/chunks/`);
    console.log(`  - メタデータ: ai-knowledge/metadata/`);
    
    console.log('\n✅ クリーンアップ完了！');
    console.log('これで新しいフォルダ構造でファイルをインポートできます。');
    
  } catch (err) {
    console.error('❌ エラーが発生しました:', err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
}

cleanupOldData();
