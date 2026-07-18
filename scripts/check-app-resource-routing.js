#!/usr/bin/env node
/**
 * app_resource_routing テーブルの構造と内容を確認
 * 使用方法: node scripts/check-app-resource-routing.js
 */

const { Pool } = require('pg');

async function checkAppResourceRouting() {
  const connectionConfig = {
    user: 'postgres',
    password: 'Takabeni',
    host: 'localhost',
    port: 5432,
    database: 'common_db'
  };

  const pool = new Pool(connectionConfig);

  try {
    console.log('📝 Checking app_resource_routing table...\n');

    // テーブル存在確認
    const tableCheck = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'app_resource_routing'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ app_resource_routing table does NOT exist');
      return;
    }

    console.log('✅ app_resource_routing table EXISTS\n');

    // カラム確認
    const columnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'app_resource_routing'
      ORDER BY ordinal_position
    `);

    console.log('📊 Table Structure:');
    console.log('─'.repeat(50));
    columnsRes.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} | ${col.data_type}`);
    });
    console.log('─'.repeat(50));

    // データ確認
    const dataRes = await pool.query('SELECT * FROM public.app_resource_routing LIMIT 10');
    console.log(`\n📦 Data (${dataRes.rows.length} rows):`);
    console.log('─'.repeat(100));
    if (dataRes.rows.length > 0) {
      const row = dataRes.rows[0];
      Object.entries(row).forEach(([key, value]) => {
        console.log(`  ${key.padEnd(25)} | ${JSON.stringify(value)}`);
      });
      if (dataRes.rows.length > 1) {
        console.log(`\n  ... and ${dataRes.rows.length - 1} more rows`);
      }
    } else {
      console.log('  (no data)');
    }
    console.log('─'.repeat(100));

    // machine_types と machines のエントリ確認
    const machineEntries = await pool.query(
      `SELECT * FROM public.app_resource_routing 
       WHERE logical_resource_name IN ('machine_types', 'machines') OR 
             logical_name IN ('machine_types', 'machines')`
    );

    console.log(`\n🔍 machine_types / machines entries: ${machineEntries.rows.length}`);
    machineEntries.rows.forEach(row => {
      console.log(`  ${JSON.stringify(row)}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await pool.end();
  }
}

checkAppResourceRouting();
