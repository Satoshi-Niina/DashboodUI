const pool = require('./shared-db-config');

async function fixRouting() {
    try {
        console.log('🔧 Fixing routing for dashboard-ui...');

        // dashboard-ui 向けのルーティング情報を追加
        // すべて master_data スキーマの同名物理テーブルへ向ける
        const resources = [
            ['machine_types', 'master_data', 'machine_types'],
            ['machines', 'master_data', 'machines'],
            ['bases', 'master_data', 'bases'],
            ['managements_offices', 'master_data', 'managements_offices'],
            ['offices', 'master_data', 'managements_offices']
        ];

        for (const [logical, schema, physical] of resources) {
            // 既存があれば更新、なければ挿入
            const query = `
        INSERT INTO public.app_resource_routing (app_id, logical_resource_name, physical_schema, physical_table, is_active)
        VALUES ('dashboard-ui', $1, $2, $3, true)
        ON CONFLICT (app_id, logical_resource_name) 
        DO UPDATE SET 
          physical_schema = EXCLUDED.physical_schema,
          physical_table = EXCLUDED.physical_table,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
      `;
            await pool.query(query, [logical, schema, physical]);
            console.log(`✅ Fixed routing for: ${logical}`);
        }

        console.log('🎉 Routing fix complete!');
    } catch (err) {
        console.error('❌ Failed to fix routing:', err);
    } finally {
        await pool.end();
    }
}

fixRouting();
