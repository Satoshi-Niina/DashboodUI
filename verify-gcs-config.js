// 新しいフォルダ設定の確認
require('dotenv').config();

console.log('=== GCS ナレッジデータ保存設定 ===\n');
console.log('環境変数:');
console.log(`  GOOGLE_CLOUD_STORAGE_BUCKET: ${process.env.GOOGLE_CLOUD_STORAGE_BUCKET}`);
console.log(`  GCS_KNOWLEDGE_FOLDER: ${process.env.GCS_KNOWLEDGE_FOLDER || '（未設定 - デフォルト: ai-knowledge）'}`);
console.log(`  STORAGE_MODE: ${process.env.STORAGE_MODE}`);

console.log('\n実際に使用される値:');
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
const folderPath = process.env.GCS_KNOWLEDGE_FOLDER || 'ai-knowledge';

console.log(`  バケット名: ${bucketName}`);
console.log(`  フォルダパス: ${folderPath}`);

console.log('\n保存先の詳細:');
console.log(`  ✅ 画像ファイル → gs://${bucketName}/${folderPath}/images/`);
console.log(`  ✅ 文書ファイル → gs://${bucketName}/${folderPath}/manuals/`);
console.log(`  ✅ その他ファイル → gs://${bucketName}/${folderPath}/originals/`);
console.log(`  ✅ チャンクデータ → gs://${bucketName}/${folderPath}/chunks/`);
console.log(`  ✅ メタデータ → gs://${bucketName}/${folderPath}/metadata/`);

console.log('\nGCSコンソールURL:');
console.log(`  https://console.cloud.google.com/storage/browser/${bucketName}/${folderPath}`);

console.log('\n✅ 設定確認完了！');
console.log('管理画面（システム設定 → AI管理 → 基礎マニュアルファイルインポート）からファイルをアップロードできます。');
