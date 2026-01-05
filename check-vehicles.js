const pool = require('./shared-db-config');

(async () => {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'master_data' AND table_name = 'vehicles' 
            ORDER BY ordinal_position
        `);
        console.table(result.rows);
    } finally {
        await pool.end();
    }
})();
