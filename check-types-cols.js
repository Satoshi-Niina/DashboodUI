const pool = require('./shared-db-config');
async function check() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'master_data' AND table_name = 'machine_types'
    `);
        console.table(res.rows);
    } finally {
        await pool.end();
    }
}
check();
