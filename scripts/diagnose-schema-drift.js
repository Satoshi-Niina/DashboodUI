#!/usr/bin/env node
/**
 * common_db と各テナント DB のテーブル構造を詳細確認
 * Schema drift を検出
 */

const { Pool } = require('pg');

async function checkAllSchemas() {
  const commonPool = new Pool({
    user: 'postgres',
    password: 'Takabeni',
    host: 'localhost',
    port: 5432,
    database: 'common_db'
  });

  const tenantDatabases = ['demo_db', 'kosei_db', 'daitetsu_db'];
  const tenantPools = {};

  try {
    console.log('\n='.repeat(80));
    console.log('DATABASE SCHEMA DIAGNOSIS');
    console.log('='.repeat(80));

    // common_db のテーブル確認
    console.log('\n📊 common_db Tables:');
    console.log('-'.repeat(80));
    const commonTablesRes = await commonPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    commonTablesRes.rows.forEach(row => {
      console.log(`  • ${row.table_name}`);
    });

    // company_db_routing テーブル構造確認
    console.log('\n🔍 company_db_routing columns:');
    console.log('-'.repeat(80));
    try {
      const companyColsRes = await commonPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'company_db_routing'
        ORDER BY ordinal_position
      `);
      companyColsRes.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`  ${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${nullable}`);
      });
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }

    // app_resource_routing テーブル構造確認
    console.log('\n🔍 app_resource_routing columns:');
    console.log('-'.repeat(80));
    try {
      const appColsRes = await commonPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'app_resource_routing'
        ORDER BY ordinal_position
      `);
      appColsRes.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`  ${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${nullable}`);
      });
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }

    // 各テナント DB のテーブル確認
    for (const dbName of tenantDatabases) {
      console.log(`\n📊 ${dbName} Tables:`);
      console.log('-'.repeat(80));

      const tenantPool = new Pool({
        user: 'postgres',
        password: 'Takabeni',
        host: 'localhost',
        port: 5432,
        database: dbName
      });
      tenantPools[dbName] = tenantPool;

      const tenantTablesRes = await tenantPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      tenantTablesRes.rows.forEach(row => {
        console.log(`  • ${row.table_name}`);
      });

      // users テーブル構造確認
      console.log(`\n  🔍 ${dbName}.users columns:`);
      try {
        const usersColsRes = await tenantPool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position
        `);
        usersColsRes.rows.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          console.log(`    ${col.column_name.padEnd(25)} | ${col.data_type.padEnd(20)} | ${nullable}`);
        });
      } catch (err) {
        console.log(`    ❌ Error: ${err.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await commonPool.end();
    for (const pool of Object.values(tenantPools)) {
      await pool.end();
    }
  }
}

checkAllSchemas();
