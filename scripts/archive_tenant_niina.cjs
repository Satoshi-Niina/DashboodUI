/**
 * 各テナントDB (daitetsu_db等) の niina レコードを安全に論理削除 (is_active = false) に設定するスクリプト
 * 
 * 既存の監査ログ、点検履歴、FK参照整合性を 100% 維持するため、物理削除ではなく論理削除を行います。
 * 実行前にバックアップを作成し、ロールバック手順を表示します。
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function archiveTenantNiina() {
  console.log('================================================================');
  console.log('🛠️ テナントDB niina レコード論理削除・アーカイブ処理');
  console.log('================================================================\n');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'daitetsu_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  });

  try {
    // 1. 現状確認
    const res = await pool.query(`SELECT id, username, display_name, is_active, role, created_at, updated_at FROM public.users WHERE username = 'niina'`);
    if (res.rows.length === 0) {
      console.log('ℹ️ daitetsu_db に niina レコードは存在しません。処理不要です。');
      return;
    }

    const current = res.rows[0];
    console.log('検出レコード (daitetsu_db.public.users):', current);

    // 2. バックアップ保存
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `daitetsu_users_niina_backup_${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(current, null, 2), 'utf8');
    console.log(`\n📦 バックアップを作成しました: ${backupPath}`);

    // 3. ロールバック手順の表示
    console.log('----------------------------------------------------------------');
    console.log('🔄 ロールバック手順 (元の状態に戻す場合):');
    console.log(`psql -d daitetsu_db -c "UPDATE public.users SET is_active = ${current.is_active}, updated_at = NOW() WHERE username = 'niina';"`);
    console.log('----------------------------------------------------------------\n');

    // 引数に --apply が指定されている場合のみ更新を実行
    if (process.argv.includes('--apply')) {
      await pool.query(`UPDATE public.users SET is_active = false, updated_at = NOW() WHERE username = 'niina'`);
      console.log('✅ daitetsu_db.public.users の niina を is_active = false (論理削除) に更新しました。');
      console.log('外部キー制約・監査ログの参照整合性は維持されています。');
    } else {
      console.log('💡 Dry-run (事前確認) モードで終了しました。');
      console.log('実際に適用するにはユーザー承認の上で "--apply" オプションを付けて実行してください。');
    }
  } catch (err) {
    console.error('❌ エラー:', err.message);
  } finally {
    await pool.end();
  }
}

archiveTenantNiina();
