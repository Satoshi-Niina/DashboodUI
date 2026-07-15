const { Pool } = require('pg');

async function addPasswordColumn() {
  const configs = [
    { name: 'kosei_db', connStr: 'postgresql://postgres:Takabeni@34.97.56.82:55432/kosei_db' },
    { name: 'demo_db', connStr: 'postgresql://postgres:Takabeni@34.97.56.82:55432/demo_db' },
    { name: 'daitetsu_db', connStr: 'postgresql://postgres:Takabeni@34.97.56.82:55432/daitetsu_db' }
  ];

  for (const cfg of configs) {
    const pool = new Pool({ connectionString: cfg.connStr });
    try {
      console.log(`\n[${cfg.name}] Adding password column...`);
      
      // password カラムが既に存在するか確認
      const checkRes = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password'
      `);
      
      if (checkRes.rows.length > 0) {
        console.log(`  ✅ password column already exists`);
      } else {
        // password カラムを追加
        await pool.query(`
          ALTER TABLE public.users 
          ADD COLUMN password VARCHAR(255) DEFAULT NULL
        `);
        console.log(`  ✅ password column added`);
      }
      
      // カラム確認
      const colRes = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name IN ('id', 'username', 'password', 'display_name', 'role')
        ORDER BY ordinal_position
      `);
      
      console.log(`  Columns in users table:`);
      colRes.rows.forEach(r => {
        console.log(`    - ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
      });
      
    } catch (err) {
      console.error(`\n❌ [${cfg.name}] Error: ${err.message}`);
    } finally {
      await pool.end();
    }
  }
}

addPasswordColumn();
