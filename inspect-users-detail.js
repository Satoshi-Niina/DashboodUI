const { Pool } = require('pg');

async function inspectUsers() {
  const configs = [
    { name: 'kosei_db', connStr: 'postgresql://postgres:Takabeni@34.97.56.82:55432/kosei_db' },
    { name: 'demo_db', connStr: 'postgresql://postgres:Takabeni@34.97.56.82:55432/demo_db' },
    { name: 'daitetsu_db', connStr: 'postgresql://postgres:Takabeni@34.97.56.82:55432/daitetsu_db' }
  ];

  for (const cfg of configs) {
    const pool = new Pool({ connectionString: cfg.connStr, connect_timeout: 5000 });
    try {
      // users テーブルのカラム確認
      const colRes = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position;
      `);
      
      // users テーブルのデータ数確認
      const dataRes = await pool.query('SELECT COUNT(*) as cnt FROM public.users');
      
      console.log(`\n=== ${cfg.name} ===`);
      console.log(`Users count: ${dataRes.rows[0].cnt}`);
      console.log('Columns:');
      colRes.rows.forEach(r => {
        console.log(`  - ${r.column_name}: ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}${r.column_default ? ` DEFAULT ${r.column_default}` : ''}`);
      });
      
      // サンプルデータ確認（password カラムがあれば）
      const hasPwd = colRes.rows.some(r => r.column_name === 'password');
      if (hasPwd) {
        const sampleRes = await pool.query('SELECT id, username, password, display_name, role FROM public.users LIMIT 1');
        if (sampleRes.rows.length > 0) {
          const user = sampleRes.rows[0];
          console.log(`Sample user: ${user.username} (id=${user.id}, role=${user.role})`);
        }
      }
    } catch (err) {
      console.log(`\n❌ ${cfg.name}: ${err.message}`);
    } finally {
      await pool.end();
    }
  }
}

inspectUsers();
