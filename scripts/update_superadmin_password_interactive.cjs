/**
 * スーパー管理者 (niina) パスワード対話的更新スクリプト
 * 
 * 特徴:
 * 1. 端末上で非表示入力 (画面に平文が表示されない)
 * 2. 入力平文・ハッシュ値はコマンドライン引数、環境変数、ログ、履歴に残さない
 * 3. common_db.public.super_admins のみを安全に更新 (bcrypt方式)
 * 4. 実行前に現在のハッシュ値の自動バックアップとロールバックSQLを出力
 * 5. 更新前に承認確認 (y/N) を実施
 */

const readline = require('readline');
const { Writable } = require('stream');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function hiddenQuestion(query) {
  return new Promise((resolve) => {
    let muted = false;
    const mutableStdout = new Writable({
      write: function(chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      }
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    });

    process.stdout.write(query);
    muted = true;

    rl.question('', (answer) => {
      muted = false;
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

function promptQuestion(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('👑 スーパー管理者 (niina) パスワード安全更新ツール');
  console.log('対象: common_db.public.super_admins (既存bcrypt方式)');
  console.log('================================================================\n');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'common_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  });

  try {
    // 1. 現在のスーパー管理者 niina の状態取得
    const curRes = await pool.query(`
      SELECT id, username, display_name, password_hash, is_active, updated_at
      FROM public.super_admins
      WHERE username = 'niina'
      LIMIT 1
    `);

    if (curRes.rows.length === 0) {
      console.error('❌ エラー: common_db.public.super_admins に niina が存在しません');
      process.exit(1);
    }

    const currentRecord = curRes.rows[0];
    console.log(`対象アカウント: ${currentRecord.username} (${currentRecord.display_name})`);
    console.log(`最終更新日時: ${currentRecord.updated_at || '初期登録'}\n`);

    // 2. パスワードの非表示入力
    const pass1 = await hiddenQuestion('🔑 新しいパスワードを入力してください (非表示): ');
    if (!pass1 || pass1.trim().length < 4) {
      console.error('❌ パスワードは4文字以上で入力してください');
      process.exit(1);
    }

    const pass2 = await hiddenQuestion('🔑 確認のためもう一度入力してください (非表示): ');
    if (pass1 !== pass2) {
      console.error('❌ パスワードが一致しません');
      process.exit(1);
    }

    // 3. バックアップファイルの保存
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `super_admin_niina_backup_${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({
      id: currentRecord.id,
      username: currentRecord.username,
      display_name: currentRecord.display_name,
      password_hash: currentRecord.password_hash,
      backed_up_at: new Date().toISOString()
    }, null, 2), 'utf8');

    console.log(`\n📦 バックアップを作成しました: ${backupPath}`);
    console.log('----------------------------------------------------------------');
    console.log('🔄 ロールバック用手順 (元のパスワードに戻す場合):');
    console.log(`psql -d common_db -c "UPDATE public.super_admins SET password_hash = '${currentRecord.password_hash}', updated_at = NOW() WHERE username = 'niina';"`);
    console.log('----------------------------------------------------------------\n');

    // 4. 承認確認
    const confirm = await promptQuestion('⚠️ common_db.public.super_admins を上記の新パスワードで更新しますか？ [y/N]: ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('⏹️ 更新を中止しました。データベースは変更されていません。');
      process.exit(0);
    }

    // 5. bcrypt ハッシュ化 & 更新実行
    console.log('⏳ bcrypt ハッシュを生成中...');
    const newHash = await bcrypt.hash(pass1.trim(), 10);

    await pool.query(`
      UPDATE public.super_admins
      SET password_hash = $1, updated_at = NOW()
      WHERE username = 'niina'
    `, [newHash]);

    console.log('\n✅ 完了: common_db.public.super_admins の niina パスワードを正常に更新しました！');
    console.log('次回ログイン時より新しいパスワードが有効になります。\n');
  } catch (err) {
    console.error('❌ 更新処理中にエラーが発生しました:', err.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
