#!/usr/bin/env node
/**
 * common_db の tenant_app_routings テーブルを確認
 * icon_class, description カラムの存在とデータを確認
 */

const { Pool } = require('pg');

async function checkTenantRoutings() {
  const connectionConfig = {
    user: 'postgres',
    password: 'Takabeni',
    host: 'localhost',
    port: 5432,
    database: 'common_db'
  };

  const pool = new Pool(connectionConfig);

  try {
    console.log('📊 Checking common_db tenant_app_routings table...\n');

    // テーブル存在確認
    const tableCheck = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tenant_app_routings'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ tenant_app_routings table does NOT exist in common_db\n');
      return;
    }

    console.log('✅ tenant_app_routings table EXISTS\n');

    // カラム確認
    const colRes = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'tenant_app_routings'
      ORDER BY ordinal_position
    `);

    console.log('📋 Columns:');
    colRes.rows.forEach(row => {
      console.log(`  • ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });
    console.log();

    // icon_class と description カラムの存在確認
    const hasIconClass = colRes.rows.some(row => row.column_name === 'icon_class');
    const hasDescription = colRes.rows.some(row => row.column_name === 'description');

    console.log('🔍 Required columns check:');
    console.log(`  ${hasIconClass ? '✅' : '❌'} icon_class`);
    console.log(`  ${hasDescription ? '✅' : '❌'} description`);
    console.log();

    // 全行取得
    const allRowsRes = await pool.query('SELECT * FROM public.tenant_app_routings ORDER BY tenant_id, app_id');
    console.log(`📦 Total entries: ${allRowsRes.rows.length}\n`);
    
    if (allRowsRes.rows.length > 0) {
      console.log('📝 All entries:');
      console.log('─'.repeat(150));
      allRowsRes.rows.forEach((row, idx) => {
        console.log(`[${idx + 1}] tenant_id: ${row.tenant_id}, app_id: ${row.app_id}, icon_class: ${row.icon_class || 'NULL'}, description: ${row.description || 'NULL'}`);
        console.log(`    target_db: ${row.target_db}, target_schema: ${row.target_schema || 'public'}`);
      });
      console.log('─'.repeat(150));
    } else {
      console.log('⚠️  No entries found! The table is EMPTY.');
      console.log('   This is why the application returns "Tenant not registered" error.');
    }

    // demo と daitetsu の存在確認
    console.log('\n🔍 Checking specific tenants:');
    const demoRes = await pool.query(`SELECT COUNT(*) as count FROM public.tenant_app_routings WHERE tenant_id = 'demo'`);
    const daitetsuRes = await pool.query(`SELECT COUNT(*) as count FROM public.tenant_app_routings WHERE tenant_id = 'daitetsu'`);
    
    console.log(`  demo: ${demoRes.rows[0].count} entries ${demoRes.rows[0].count > 0 ? '✅' : '❌'}`);
    console.log(`  daitetsu: ${daitetsuRes.rows[0].count} entries ${daitetsuRes.rows[0].count > 0 ? '✅' : '❌'}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

checkTenantRoutings();
