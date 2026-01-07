const pool = require('./shared-db-config');
async function find() {
    try {
        const res = await pool.query(`
      SELECT nspname, relname, 'constraint' as type
      FROM pg_constraint con 
      JOIN pg_class rel ON rel.oid = con.conrelid 
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
      WHERE con.conname = 'machine_types_machine_type_name_key'
      UNION ALL
      SELECT schemaname, tablename, 'index' as type
      FROM pg_indexes
      WHERE indexname = 'machine_types_machine_type_name_key'
    `);
        console.table(res.rows);
    } finally {
        await pool.end();
    }
}
find();
