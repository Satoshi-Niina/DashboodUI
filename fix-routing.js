const pool = require('./shared-db-config');

async function fixRouting() {
    try {
        console.log('🔧 ルーティングテーブルを修正中...\n');
        
        // 現在のルーティング設定を確認
        const current = await pool.query(`
            SELECT * FROM public.app_resource_routing 
            WHERE app_id = 'dashboard-ui' 
            ORDER BY logical_resource_name
        `);
        
        console.log('現在のルーティング設定:');
        console.table(current.rows);
        
        // managements_offices → management_offices に修正
        await pool.query(`
            UPDATE public.app_resource_routing 
            SET physical_table = 'management_offices'
            WHERE app_id = 'dashboard-ui' 
            AND logical_resource_name = 'managements_offices'
        `);
        
        console.log('\n✅ ルーティングを修正しました: managements_offices → management_offices\n');
        
        // 修正後の設定を確認
        const updated = await pool.query(`
            SELECT * FROM public.app_resource_routing 
            WHERE app_id = 'dashboard-ui' 
            ORDER BY logical_resource_name
        `);
        
        console.log('修正後のルーティング設定:');
        console.table(updated.rows);
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
    } finally {
        await pool.end();
    }
}

fixRouting();
