#!/usr/bin/env node
/**
 * 本番DBに tenant_app_routings テーブルを作成・初期化するスクリプト
 * 
 * 実行前に確認：
 * 1. Cloud SQL Proxy が起動しているか
 *    起動コマンド: cloud-sql-proxy maint-vehicle-management:asia-northeast2-a:free-trial-first-project
 * 
 * 2. 本番環境のDBパスワードが正しいか（環境変数またはコード内で設定）
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupProductionDB() {
  // 本番DB接続設定
  // Cloud SQL Proxy経由で接続する場合
  const connectionConfig = {
    user: 'postgres',
    password: 'Takabeni',
    host: 'localhost',  // Cloud SQL Proxy経由
    port: 5432,
    database: 'common_db'
  };

  // または、直接Cloud SQLに接続する場合（Cloud SQL Proxyなし）
  // const connectionConfig = {
  //   user: 'postgres',
  //   password: 'Takabeni',
  //   host: '/cloudsql/maint-vehicle-management:asia-northeast2:free-trial-first-project',
  //   database: 'common_db'
  // };

  const pool = new Pool(connectionConfig);

  try {
    console.log('🚀 Connecting to production database (common_db)...\n');

    // SQLファイルを読み込み
    const sqlFilePath = path.join(__dirname, 'sql', 'setup-tenant-routings-production.sql');
    console.log(`📖 Reading SQL file: ${sqlFilePath}\n`);
    
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`❌ SQL file not found: ${sqlFilePath}`);
      return;
    }

    const sqlScript = fs.readFileSync(sqlFilePath, 'utf-8');

    // SQLを実行
    console.log('⚙️  Executing SQL script...\n');
    await pool.query(sqlScript);
    console.log('✅ SQL script executed successfully!\n');

    // 結果を確認
    console.log('📊 Checking results...\n');
    const result = await pool.query(`
      SELECT 
        tenant_key,
        app_id,
        app_name,
        icon,
        icon_class,
        description,
        is_active
      FROM public.tenant_app_routings
      ORDER BY tenant_key, display_order
    `);

    console.log(`✅ Total entries: ${result.rows.length}\n`);
    console.log('📝 Entries:');
    console.log('─'.repeat(150));
    result.rows.forEach((row, idx) => {
      console.log(`[${idx + 1}] ${row.tenant_key}/${row.app_id}: ${row.app_name}`);
      console.log(`    icon: ${row.icon}, icon_class: ${row.icon_class || 'NULL'}`);
      console.log(`    description: ${row.description || 'NULL'}`);
      console.log(`    is_active: ${row.is_active}`);
    });
    console.log('─'.repeat(150));

    console.log('\n✅ Setup completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('1. Cloud Runサービスを再デプロイして変更を反映');
    console.log('2. アプリケーションにアクセスして動作確認');
    console.log('3. ログで "Tenant not registered" エラーが解消されたか確認');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    console.error('\n💡 Troubleshooting:');
    console.error('- Cloud SQL Proxyが起動しているか確認してください');
    console.error('  起動: cloud-sql-proxy maint-vehicle-management:asia-northeast2-a:free-trial-first-project');
    console.error('- DB接続情報（ユーザー名、パスワード、ホスト）が正しいか確認してください');
  } finally {
    await pool.end();
  }
}

setupProductionDB();
