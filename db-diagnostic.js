const pool = require('./shared-db-config');

async function diagnostic() {
    try {
        console.log('--- 1. APP_IDとルーティングの確認 ---');
        const appRes = await pool.query("SELECT DISTINCT app_id FROM public.app_resource_routing");
        console.log('Available App IDs:', appRes.rows.map(r => r.app_id));

        const routingRes = await pool.query(`
      SELECT logical_resource_name, physical_schema, physical_table, is_active 
      FROM public.app_resource_routing 
      WHERE is_active = true 
      ORDER BY app_id, logical_resource_name
    `);
        console.table(routingRes.rows);

        console.log('\n--- 2. machine_types と machines の物理型確認 ---');
        // ルーティング先の物理テーブルを直接調べる
        const tables = routingRes.rows.filter(r =>
            ['machine_types', 'machines', 'MACHINE_TYPES', 'MACHINES'].includes(r.logical_resource_name)
        );

        for (const t of tables) {
            const colRes = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [t.physical_schema, t.physical_table]);
            console.log(`\nTable: ${t.physical_schema}.${t.physical_table} (${t.logical_resource_name})`);
            console.table(colRes.rows);
        }

    } catch (err) {
        console.error('Diagnostic failed:', err);
    } finally {
        await pool.end();
    }
}

diagnostic();
