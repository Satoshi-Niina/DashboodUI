const pool = require('./shared-db-config');

async function verifyDetailedSchema() {
    try {
        console.log('🔍 master_dataスキーマの詳細確認を実施します...\n');

        const tables = ['machine_types', 'machines'];
        for (const table of tables) {
            const result = await pool.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'master_data' AND table_name = $1
                ORDER BY ordinal_position
            `, [table]);

            console.log(`--- Table: master_data.${table} ---`);
            if (result.rows.length === 0) {
                console.log('⚠️ テーブルが見つかりません');
            } else {
                console.table(result.rows);
            }
        }

        console.log('\n--- ルーティングテーブル (public.app_resource_routing) ---');
        const routing = await pool.query(`
            SELECT * FROM public.app_resource_routing WHERE app_id = 'dashboard-ui'
        `);
        console.table(routing.rows);

    } catch (error) {
        console.error('❌ エラー:', error.message);
    } finally {
        await pool.end();
    }
}

verifyDetailedSchema();
