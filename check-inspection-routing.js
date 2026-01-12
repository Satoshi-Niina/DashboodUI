const pool = require('./shared-db-config');

async function checkInspectionRouting() {
    try {
        console.log('=== 検修関連テーブルのルーティング確認 ===\n');

        // 検修関連のルーティング
        const routingRes = await pool.query(`
            SELECT resource_type, resource_name, schema_name, table_name 
            FROM master_data.app_resource_routing 
            WHERE resource_type LIKE '%inspection%' OR resource_name LIKE '%inspection%'
            ORDER BY resource_type
        `);

        console.log('検修関連ルーティング設定:');
        console.table(routingRes.rows);

        // 検修関連テーブルの存在確認
        console.log('\n=== 検修関連テーブルの存在確認 ===\n');
        const tablesRes = await pool.query(`
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE tablename LIKE '%inspection%'
            ORDER BY schemaname, tablename
        `);

        console.log('検修関連テーブル:');
        console.table(tablesRes.rows);

    } catch (error) {
        console.error('エラー:', error.message);
    } finally {
        await pool.end();
    }
}

checkInspectionRouting();
