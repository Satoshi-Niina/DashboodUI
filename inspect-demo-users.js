const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function inspectDemo() {
  console.log('🔍 Inspecting demo_db users...\n');

  const pool = new Pool({ 
    connectionString: 'postgresql://postgres:Takabeni@34.97.56.82:55432/demo_db',
    connect_timeout: 5000 
  });

  try {
    // users テーブルの全ユーザーを取得
    const res = await pool.query(`
      SELECT id, username, password, display_name, role 
      FROM public.users 
      ORDER BY id
    `);

    if (res.rows.length === 0) {
      console.log('❌ No users found in demo_db');
      return;
    }

    console.log(`Found ${res.rows.length} users:\n`);

    for (const user of res.rows) {
      console.log(`ID: ${user.id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Display: ${user.display_name}`);
      console.log(`  Role: ${user.role}`);
      
      if (!user.password) {
        console.log(`  Password: ❌ NULL`);
      } else if (user.password.startsWith('$2')) {
        console.log(`  Password: ✅ HASHED (bcrypt)`);
        
        // テスト：common password でマッチするか確認
        const testPassword = 'demo123';
        const match = await bcrypt.compare(testPassword, user.password);
        console.log(`  Test with '${testPassword}': ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
      } else {
        console.log(`  Password: ⚠️ PLAINTEXT: "${user.password}"`);
      }
      console.log();
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

inspectDemo();
