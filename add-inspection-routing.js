// 検修マスタテーブルのルーティングを追加するスクリプト
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Takabeni@localhost:55432/webappdb'
});

async function addInspectionRouting() {
    console.log('📋 検修マスタのルーティングを追加します...\n');
    
    try {
        const appId = 'dashboard-ui';
        
        // 既存のルーティングを確認
        const existingRoutes = await pool.query(`
            SELECT logical_table_name, schema_name, physical_table_name
            FROM master_data.table_routing
            WHERE app_id = $1 AND logical_table_name IN ('inspection_types', 'inspection_schedules')
        `, [appId]);
        
        if (existingRoutes.rows.length > 0) {
            console.log('⚠️  既存のルーティングが見つかりました:');
            existingRoutes.rows.forEach(route => {
                console.log(`   - ${route.logical_table_name} → ${route.schema_name}.${route.physical_table_name}`);
            });
            
            // 既存のルーティングを削除
            await pool.query(`
                DELETE FROM master_data.table_routing
                WHERE app_id = $1 AND logical_table_name IN ('inspection_types', 'inspection_schedules')
            `, [appId]);
            console.log('✅ 既存のルーティングを削除しました\n');
        }
        
        // 新しいルーティングを追加
        const routings = [
            { table: 'inspection_types', description: '検修種別マスタテーブル' },
            { table: 'inspection_schedules', description: '検修周期・期間設定テーブル' }
        ];
        
        for (const routing of routings) {
            await pool.query(`
                INSERT INTO master_data.table_routing (app_id, logical_table_name, schema_name, physical_table_name, description)
                VALUES ($1, $2, 'master_data', $3, $4)
            `, [appId, routing.table, routing.table, routing.description]);
            
            console.log(`✅ ルーティングを追加: ${routing.table} → master_data.${routing.table}`);
        }
        
        // 確認
        console.log('\n🔍 最終確認:');
        const finalCheck = await pool.query(`
            SELECT logical_table_name, schema_name, physical_table_name, description
            FROM master_data.table_routing
            WHERE app_id = $1 AND logical_table_name IN ('inspection_types', 'inspection_schedules')
            ORDER BY logical_table_name
        `, [appId]);
        
        finalCheck.rows.forEach(route => {
            console.log(`   ✓ ${route.logical_table_name} → ${route.schema_name}.${route.physical_table_name}`);
            console.log(`     ${route.description}`);
        });
        
        console.log('\n✅ ルーティングの追加が完了しました！');
        
    } catch (err) {
        console.error('\n❌ エラー:', err.message);
        console.error('詳細:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

addInspectionRouting();
