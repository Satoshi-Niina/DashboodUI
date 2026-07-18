#!/usr/bin/env node
/**
 * company_db_routing テーブルをクリーンアップ・修正
 * - demo_env（古い重複）を削除
 * - kosei エントリを追加（存在しない場合）
 * - 各テナント ID が一意になるよう修正
 */

const { Pool } = require('pg');

async function fixCompanyRouting() {
  const connectionConfig = {
    user: 'postgres',
    password: 'Takabeni',
    host: 'localhost',
    port: 5432,
    database: 'common_db'
  };

  const pool = new Pool(connectionConfig);

  try {
    console.log('🔧 Fixing company_db_routing table...\n');

    // 現在のデータ確認
    const beforeRes = await pool.query('SELECT * FROM public.company_db_routing ORDER BY tenant_id');
    console.log('📝 Before cleanup:');
    console.log(JSON.stringify(beforeRes.rows, null, 2));
    console.log();

    // 1. demo_env の削除（古い重複）
    console.log('🗑️ Removing demo_env (old duplicate)...');
    const deleteRes = await pool.query(
      'DELETE FROM public.company_db_routing WHERE tenant_id = $1',
      ['demo_env']
    );
    console.log(`✅ Deleted ${deleteRes.rowCount} row(s) for demo_env\n`);

    // 2. kosei エントリの確認・追加
    console.log('🔍 Checking kosei entry...');
    const koseiRes = await pool.query(
      'SELECT * FROM public.company_db_routing WHERE tenant_id = $1',
      ['kosei']
    );

    if (koseiRes.rows.length === 0) {
      console.log('❌ kosei entry not found. Creating...');
      
      // kosei 用のエントリを作成
      // daitetsu の CloudSQL connection string をベースに（同じインスタンス）
      const insertRes = await pool.query(`
        INSERT INTO public.company_db_routing 
        (tenant_id, cloud_sql_instance, db_name, company_name, gcs_bucket, url_base, updated_at)
        VALUES 
        ($1, $2, $3, $4, $5, $6, now())
        RETURNING *
      `, [
        'kosei',                                                                        // tenant_id
        '/cloudsql/maint-vehicle-management:asia-northeast2:free-trial-first-project', // cloud_sql_instance
        'kosei_db',                                                                     // db_name
        '高清工業株式会社',                                                             // company_name
        'gcs-bucket-kosei',                                                             // gcs_bucket
        'https://dashboard-ui-800711608362.asia-northeast2.run.app/kosei'             // url_base
      ]);
      console.log(`✅ kosei entry created: ${JSON.stringify(insertRes.rows[0])}\n`);
    } else {
      console.log(`✅ kosei entry already exists\n`);
    }

    // 3. 修正後のデータ確認
    const afterRes = await pool.query('SELECT * FROM public.company_db_routing ORDER BY tenant_id');
    console.log('📝 After cleanup:');
    console.log(JSON.stringify(afterRes.rows, null, 2));
    console.log();

    console.log('✅ Cleanup complete!');
    console.log('\n📋 Final routing configuration:');
    afterRes.rows.forEach(row => {
      console.log(`  ${row.tenant_id.padEnd(15)} → ${row.db_name}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

fixCompanyRouting();
