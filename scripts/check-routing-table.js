#!/usr/bin/env node
/**
 * common_db の app_resource_routing テーブルを確認
 * machine_types/machines などの routing エントリを確認
 */

const { Pool } = require('pg');

async function checkRouting() {
  const connectionConfig = {
    user: 'postgres',
    password: 'Takabeni',
    host: 'localhost',
    port: 5432,
    database: 'common_db'
  };

  const pool = new Pool(connectionConfig);

  try {
    console.log('📊 Checking common_db routing...\n');

    // app_resource_routing テーブル存在確認
    const tableCheck = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'app_resource_routing'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ app_resource_routing table does NOT exist in common_db\n');
      return;
    }

    console.log('✅ app_resource_routing table EXISTS\n');

    // カラム確認
    const colRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'app_resource_routing'
      ORDER BY ordinal_position
    `);

    console.log('📋 Columns:');
    colRes.rows.forEach(row => console.log(`  • ${row.column_name}`));
    console.log();

    // 全行確認
    const allRowsRes = await pool.query('SELECT * FROM public.app_resource_routing');
    console.log(`📦 Total entries: ${allRowsRes.rows.length}\n`);
    
    if (allRowsRes.rows.length > 0) {
      console.log('📝 All entries:');
      console.log('─'.repeat(120));
      allRowsRes.rows.forEach((row, idx) => {
        console.log(`[${idx + 1}] ${JSON.stringify(row)}`);
      });
      console.log('─'.repeat(120));
    }

    // machine_types / machines に関するエントリを探す
    console.log('\n🔍 Searching for machine-related entries...');
    const machineRes = await pool.query(`
      SELECT * FROM public.app_resource_routing 
      WHERE logical_resource_name ILIKE '%machine%' 
         OR logical_name ILIKE '%machine%'
         OR physical_table_name ILIKE '%machine%'
    `);
    
    if (machineRes.rows.length === 0) {
      console.log('❌ No entries found for machine-related resources!');
    } else {
      console.log(`✅ Found ${machineRes.rows.length} machine-related entries:`);
      machineRes.rows.forEach(row => {
        console.log(`  ${JSON.stringify(row)}`);
      });
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

checkRouting();
