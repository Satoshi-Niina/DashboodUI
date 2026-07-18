const { Pool } = require('pg');

async function inspectDatabases() {
  const configs = [
    { name: 'common_db', connStr: 'postgresql://postgres:Takabeni@localhost:5432/common_db' },
    { name: 'demo_db', connStr: 'postgresql://postgres:Takabeni@localhost:5432/demo_db' },
    { name: 'daitetsu_db', connStr: 'postgresql://postgres:Takabeni@localhost:5432/daitetsu_db' },
    { name: 'kosei_db', connStr: 'postgresql://postgres:Takabeni@localhost:5432/kosei_db' }
  ];

  for (const cfg of configs) {
    const pool = new Pool({ connectionString: cfg.connStr });
    try {
      // テーブル一覧を取得
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`【${cfg.name}】 Tables in public schema:`);
      console.log('='.repeat(60));

      for (const table of tables.rows) {
        const tableName = table.table_name;
        
        // 各テーブルのカラム情報を取得
        const columns = await pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [tableName]);

        // 各テーブルの行数を取得
        const count = await pool.query(`SELECT COUNT(*) as count FROM public."${tableName}"`);

        console.log(`\n  📋 ${tableName} (${count.rows[0].count} rows)`);
        columns.rows.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? '✓' : ' ';
          const default_val = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          console.log(`     - ${col.column_name}: ${col.data_type} [NULL: ${nullable}]${default_val}`);
        });
      }

      console.log(`\n✅ Total tables: ${tables.rows.length}`);

    } catch (err) {
      console.log(`\n❌ ${cfg.name}: ${err.message}`);
    } finally {
      await pool.end();
    }
  }
}

inspectDatabases();
