#!/usr/bin/env node
/**
 * common_db の company_db_routing テーブルを詳細確認
 */

const { Pool } = require('pg');

async function checkCompanyRouting() {
  const connectionConfig = {
    user: 'postgres',
    password: 'Takabeni',
    host: 'localhost',
    port: 5432,
    database: 'common_db'
  };

  const pool = new Pool(connectionConfig);

  try {
    console.log('📊 Checking company_db_routing table...\n');

    const routingRes = await pool.query('SELECT * FROM public.company_db_routing ORDER BY tenant_id');
    
    console.log('📋 Current entries:');
    console.log('─'.repeat(150));
    console.log(JSON.stringify(routingRes.rows, null, 2));
    console.log('─'.repeat(150));
    
    console.log(`\n✅ Total entries: ${routingRes.rows.length}\n`);

    // 問題の検出
    const tenantIds = routingRes.rows.map(r => r.tenant_id);
    const duplicates = tenantIds.filter((id, idx) => tenantIds.indexOf(id) !== idx);
    
    if (duplicates.length > 0) {
      console.log('⚠️ WARNING: Duplicate tenant_ids found:');
      duplicates.forEach(id => {
        const entries = routingRes.rows.filter(r => r.tenant_id === id);
        console.log(`  ${id}: ${entries.length} entries`);
        entries.forEach(e => console.log(`    - dbName=${e.db_name}, updated=${e.updated_at}`));
      });
    }

    // kosei の確認
    const koseiEntry = routingRes.rows.find(r => r.tenant_id === 'kosei');
    if (!koseiEntry) {
      console.log('❌ ERROR: kosei entry is MISSING from company_db_routing!');
    } else {
      console.log(`✅ kosei entry found: ${koseiEntry.db_name}`);
    }

    // demo の確認
    const demoEntries = routingRes.rows.filter(r => r.tenant_id === 'demo' || r.tenant_id === 'demo_env');
    if (demoEntries.length > 1) {
      console.log(`⚠️ WARNING: Multiple demo entries found (${demoEntries.length}):`);
      demoEntries.forEach(e => console.log(`  - tenant_id=${e.tenant_id}, db_name=${e.db_name}, updated=${e.updated_at}`));
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkCompanyRouting();
