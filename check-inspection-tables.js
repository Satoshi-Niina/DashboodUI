const pool = require('./shared-db-config');

async function checkTableStructures() {
    try {
        console.log('=== inspection_types テーブル構造 ===\n');
        const typesColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'master_data' AND table_name = 'inspection_types'
            ORDER BY ordinal_position
        `);
        console.table(typesColumns.rows);

        console.log('\n=== inspection_schedules テーブル構造 ===\n');
        const schedulesColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'master_data' AND table_name = 'inspection_schedules'
            ORDER BY ordinal_position
        `);
        console.table(schedulesColumns.rows);

    } catch (error) {
        console.error('エラー:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

checkTableStructures();
