const { Pool } = require('pg');

async function checkSchema() {
  const configs = [
    { name: 'common_db', connStr: 'postgresql://postgres:Takabeni@34.97.56.82:55432/common_db' },
    { name: 'demo_db', connStr: 'postgresql://postgres:Takabeni@34.97.56.82:55432/demo_db' },
    { name: 'daitetsu_db', connStr: 'postgresql://postgres:Takabeni@34.97.56.82:55432/daitetsu_db' }
  ];

  for (const cfg of configs) {
    const pool = new Pool({ connectionString: cfg.connStr });
    try {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position;
      `);
      console.log(`\n=== ${cfg.name} users table ===`);
      res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (null: ${r.is_nullable})`));
      console.log(`  Total columns: ${res.rows.length}`);
    } catch (err) {
      console.log(`\n❌ ${cfg.name}: ${err.message}`);
    } finally {
      await pool.end();
    }
  }
}

checkSchema();
