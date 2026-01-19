// アップロードされたファイルの確認スクリプト
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkUploads() {
  try {
    console.log('=== アップロードファイル履歴を確認中 ===\n');
    
    const result = await pool.query(`
      SELECT 
        id,
        file_name,
        file_type,
        file_size_bytes,
        upload_source,
        gcs_original_path,
        gcs_chunks_path,
        gcs_rag_metadata_path,
        total_chunks,
        processing_status,
        uploaded_at
      FROM master_data.ai_knowledge_data
      ORDER BY uploaded_at DESC NULLS LAST, id DESC
      LIMIT 20
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ アップロードされたファイルがデータベースに記録されていません。');
      console.log('\n考えられる原因:');
      console.log('1. ファイルアップロードが正常に完了していない');
      console.log('2. データベース接続に問題がある');
      console.log('3. master_data.ai_knowledge_dataテーブルが存在しない');
    } else {
      console.log(`✅ ${result.rows.length}件のファイルが見つかりました:\n`);
      
      result.rows.forEach((row, index) => {
        console.log(`[${index + 1}] ID: ${row.id}`);
        console.log(`    ファイル名: ${row.file_name}`);
        console.log(`    ファイルタイプ: ${row.file_type}`);
        console.log(`    サイズ: ${(row.file_size_bytes / 1024).toFixed(2)} KB`);
        console.log(`    保存場所: ${row.upload_source}`);
        console.log(`    元ファイルパス: ${row.gcs_original_path || '（保存なし）'}`);
        console.log(`    チャンクパス: ${row.gcs_chunks_path || '（なし）'}`);
        console.log(`    メタデータパス: ${row.gcs_rag_metadata_path || '（なし）'}`);
        console.log(`    チャンク数: ${row.total_chunks || 0}`);
        console.log(`    処理状態: ${row.processing_status}`);
        console.log(`    作成日時: ${row.uploaded_at || '（記録なし）'}`);
        console.log('');
      });
      
      // GCS設定も確認
      console.log('\n=== GCS設定を確認中 ===');
      console.log(`GOOGLE_CLOUD_STORAGE_BUCKET: ${process.env.GOOGLE_CLOUD_STORAGE_BUCKET || '（未設定）'}`);
      console.log(`GCS_BUCKET_NAME: ${process.env.GCS_BUCKET_NAME || '（未設定）'}`);
      console.log(`STORAGE_MODE: ${process.env.STORAGE_MODE || 'local'}`);
      
      const bucketName = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
      console.log(`\n使用されるバケット名: ${bucketName}`);
      
      if (result.rows.length > 0 && result.rows[0].gcs_chunks_path) {
        const examplePath = result.rows[0].gcs_chunks_path;
        console.log(`\nGCSアクセスURL例:`);
        console.log(`https://console.cloud.google.com/storage/browser/${bucketName}/${examplePath.split('/')[0]}`);
      }
    }
    
  } catch (err) {
    console.error('❌ エラーが発生しました:', err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkUploads();
