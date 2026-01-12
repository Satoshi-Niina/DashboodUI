const pool = require('./shared-db-config');

async function checkDatabase() {
    try {
        console.log('=== スキーマ確認 ===\n');
        const schemaRes = await pool.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schema_name
        `);
        console.table(schemaRes.rows);

        console.log('\n=== 検修関連テーブル確認 ===\n');
        const tablesRes = await pool.query(`
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
              AND tablename LIKE '%inspection%'
            ORDER BY schemaname, tablename
        `);
        console.table(tablesRes.rows);

        console.log('\n=== master_data スキーマの全テーブル ===\n');
        const masterTablesRes = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'master_data'
            ORDER BY tablename
        `);
        console.table(masterTablesRes.rows);

    } catch (error) {
        console.error('エラー:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

checkDatabase();
