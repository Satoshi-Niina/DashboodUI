#!/usr/bin/env node
/**
 * demo_db のスキーマ状態を確認（公開情報を取得）
 * 使用方法: node scripts/check-demo-db-schema.js
 */

const { Pool } = require('pg');

async function checkDemoDB() {
  const connectionConfig = {
    user: 'postgres',
    password: 'Takabeni',
    host: 'localhost',
    port: 5432,
    database: 'demo_db'
  };

  const pool = new Pool(connectionConfig);

  try {
    console.log('📊 Checking demo_db Schema...\n');

    // public schema のテーブル一覧
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tables in public schema:');
    console.log('─'.repeat(60));
    if (tablesRes.rows.length === 0) {
      console.log('  (no tables)');
    } else {
      tablesRes.rows.forEach(row => {
        console.log(`  • ${row.table_name}`);
      });
    }
    console.log('─'.repeat(60));

    // 各重要テーブルの行数を確認
    const importantTables = [
      'users',
      'machine_types',
      'machines',
      'management_offices',
      'bases',
      'inspection_types',
      'inspection_schedules'
    ];

    console.log('\n📦 Row counts for important tables:');
    console.log('─'.repeat(60));
    for (const tableName of importantTables) {
      try {
        const countRes = await pool.query(`SELECT COUNT(*) FROM public."${tableName}"`);
        const count = countRes.rows[0].count;
        const exists = count >= 0 ? '✅' : '❌';
        console.log(`  ${exists} ${tableName.padEnd(30)} | ${count} rows`);
      } catch (err) {
        console.log(`  ❌ ${tableName.padEnd(30)} | TABLE DOES NOT EXIST`);
      }
    }
    console.log('─'.repeat(60));

    // users テーブルの構造確認
    console.log('\n🔍 users table structure:');
    console.log('─'.repeat(60));
    try {
      const colRes = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position
      `);
      colRes.rows.forEach(col => {
        console.log(`  ${col.column_name.padEnd(25)} | ${col.data_type}`);
      });

      // サンプルデータ表示
      const dataRes = await pool.query(`SELECT * FROM public.users LIMIT 3`);
      console.log('\n📝 Sample data (first 3 rows):');
      dataRes.rows.forEach(row => {
        console.log(`  ${JSON.stringify(row)}`);
      });
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }
    console.log('─'.repeat(60));

  } catch (err) {
    console.error('❌ Connection Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkDemoDB();
