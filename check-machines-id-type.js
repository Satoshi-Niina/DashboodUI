const pool = require('./shared-db-config');

async function checkMachinesIdType() {
    try {
        console.log('=== master_data.machines テーブルのid型確認 ===\n');
        const result = await pool.query(`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'master_data' 
            AND table_name = 'machines' 
            AND column_name = 'id'
        `);
        console.table(result.rows);

    } catch (error) {
        console.error('エラー:', error.message);
    } finally {
        await pool.end();
    }
}

checkMachinesIdType();
