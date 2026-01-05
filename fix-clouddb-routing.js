const { Pool } = require('pg');

// Cloud SQL接続（本番環境）
const pool = new Pool({
    host: '/cloudsql/maint-vehicle-management:asia-northeast2:free-trial-first-project',
    user: 'postgres',
    password: process.env.DB_PASSWORD || 'Takabeni',
    database: 'webappdb',
    max: 5
});

async function fixCloudDBRouting() {
    try {
        console.log('🔧 Cloud SQLのルーティングテーブルを修正中...\n');
        
        // 現在の設定を確認
        const current = await pool.query(`
            SELECT logical_resource_name, physical_table 
            FROM public.app_resource_routing 
            WHERE app_id = 'dashboard-ui'
            ORDER BY logical_resource_name
        `);
        
        console.log('現在のルーティング設定:');
        console.table(current.rows);
        
        // managements_offices → management_offices に修正
        const result = await pool.query(`
            UPDATE public.app_resource_routing 
            SET physical_table = 'management_offices'
            WHERE app_id = 'dashboard-ui' 
              AND logical_resource_name = 'managements_offices'
              AND physical_table != 'management_offices'
            RETURNING *
        `);
        
        if (result.rowCount > 0) {
            console.log('\n✅ ルーティングを修正しました:');
            console.table(result.rows);
        } else {
            console.log('\n⚠️  既に修正済みです');
        }
        
        // 修正後の設定を確認
        const updated = await pool.query(`
            SELECT logical_resource_name, physical_table 
            FROM public.app_resource_routing 
            WHERE app_id = 'dashboard-ui'
            ORDER BY logical_resource_name
        `);
        
        console.log('\n修正後のルーティング設定:');
        console.table(updated.rows);
        
        console.log('\n✅ 完了！Cloud Runサービスを再起動してください。');
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

fixCloudDBRouting();
