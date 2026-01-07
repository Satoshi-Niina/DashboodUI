const pool = require('./shared-db-config');

async function fixMachines() {
    try {
        console.log('--- 保守用車テーブル(machines)の最終修正 ---');

        // 1. 存在する全マシンのテーブルを特定
        const tablesRes = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'machines'
    `);

        console.log('Found tables:', tablesRes.rows);

        for (const row of tablesRes.rows) {
            const fullPath = `"${row.table_schema}"."${row.table_name}"`;
            console.log(`Fixing table: ${fullPath}`);

            try {
                await pool.query(`ALTER TABLE ${fullPath} ADD COLUMN IF NOT EXISTS type_certification TEXT`);
                await pool.query(`ALTER TABLE ${fullPath} ADD COLUMN IF NOT EXISTS office_id TEXT`);
                console.log(`✅ Success for ${fullPath}`);
            } catch (e) {
                console.error(`❌ Error for ${fullPath}:`, e.message);
            }
        }

        // 2. ルーティングの再確認と修正
        console.log('\n--- ルーティングの最終調整 ---');
        await pool.query(`
      UPDATE public.app_resource_routing 
      SET physical_schema = 'master_data', physical_table = 'machines'
      WHERE app_id = 'dashboard-ui' AND logical_resource_name = 'machines'
    `);
        console.log('✅ Routing fixed to master_data.machines');

    } catch (err) {
        console.error('Final fix failed:', err);
    } finally {
        await pool.end();
    }
}

fixMachines();
