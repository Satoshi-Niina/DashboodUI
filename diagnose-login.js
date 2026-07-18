const { Pool } = require('pg');

async function diagnoseLogin() {
  console.log('🔍 Diagnosing login error 401...\n');

  const databases = {
    common_db: 'postgresql://postgres:Takabeni@34.97.56.82:55432/common_db',
    demo_db: 'postgresql://postgres:Takabeni@34.97.56.82:55432/demo_db'
  };

  // 1. common_db のルーティングテーブル確認
  console.log('=== 1. common_db - Routing Tables ===');
  const commonPool = new Pool({ connectionString: databases.common_db, connect_timeout: 5000 });
  try {
    const routingRes = await commonPool.query(`
      SELECT company_id, company_name, db_name, tenant_path 
      FROM public.company_db_routing 
      ORDER BY company_id
    `);
    console.log('company_db_routing:');
    routingRes.rows.forEach(r => {
      console.log(`  ${r.company_id}: name="${r.company_name}", db="${r.db_name}", path="${r.tenant_path || '(null)'}"`);
    });
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }
  await commonPool.end();

  // 2. demo_db の users テーブルスキーマ確認
  console.log('\n=== 2. demo_db - Users Table Schema ===');
  const demoPool = new Pool({ connectionString: databases.demo_db, connect_timeout: 5000 });
  try {
    // テーブル存在確認
    const tableRes = await demoPool.query(`
      SELECT EXISTS(SELECT 1 FROM information_schema.tables 
        WHERE table_schema='public' AND table_name='users')
    `);
    console.log(`Users table exists: ${tableRes.rows[0].exists}`);

    if (tableRes.rows[0].exists) {
      // スキーマ確認
      const colRes = await demoPool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users'
        ORDER BY ordinal_position
      `);
      console.log('Columns:');
      colRes.rows.forEach(r => {
        console.log(`  - ${r.column_name}: ${r.data_type}${r.is_nullable === 'NO' ? ' (NOT NULL)' : ''}`);
      });

      // ユーザーデータ確認
      const userRes = await demoPool.query('SELECT COUNT(*) as cnt FROM public.users');
      console.log(`\nUsers count: ${userRes.rows[0].cnt}`);

      // サンプルユーザー確認
      if (userRes.rows[0].cnt > 0) {
        const sampleRes = await demoPool.query(`
          SELECT id, username, password, display_name, role 
          FROM public.users 
          LIMIT 3
        `);
        console.log('\nSample users:');
        sampleRes.rows.forEach(u => {
          const pwdStatus = u.password 
            ? (u.password.startsWith('$2') ? 'hashed' : 'plain')
            : 'NULL';
          console.log(`  - ${u.username}: role=${u.role}, pwd=${pwdStatus}, display_name="${u.display_name}"`);
        });
      }
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }
  await demoPool.end();

  console.log('\n✅ Diagnosis complete');
}

diagnoseLogin().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
