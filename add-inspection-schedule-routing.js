// 検修マスタのルーティングを追加するスクリプト
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Takabeni@localhost:55432/webappdb'
});

async function addInspectionScheduleRouting() {
    console.log('📋 検修スケジュールのルーティングを追加します...\n');
    
    try {
        const appId = 'dashboard-ui';
        
        // 既存のルーティングを確認
        const existingRoutes = await pool.query(`
            SELECT logical_resource_name, physical_schema, physical_table
            FROM public.app_resource_routing
            WHERE app_id = $1 AND logical_resource_name IN ('inspection_schedules', 'INSPECTION_SCHEDULES')
        `, [appId]);
        
        if (existingRoutes.rows.length > 0) {
            console.log('⚠️  既存のルーティングが見つかりました:');
            existingRoutes.rows.forEach(route => {
                console.log(`   - ${route.logical_resource_name} → ${route.physical_schema}.${route.physical_table}`);
            });
            console.log('\n既に登録されているため、処理をスキップします。');
        } else {
            // 新しいルーティングを追加
            await pool.query(`
                INSERT INTO public.app_resource_routing 
                (app_id, logical_resource_name, physical_schema, physical_table, is_readonly, is_active)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [appId, 'inspection_schedules', 'master_data', 'inspection_schedules', false, true]);
            
            console.log(`✅ ルーティングを追加: inspection_schedules → master_data.inspection_schedules`);
            
            // 大文字版も追加
            await pool.query(`
                INSERT INTO public.app_resource_routing 
                (app_id, logical_resource_name, physical_schema, physical_table, is_readonly, is_active)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [appId, 'INSPECTION_SCHEDULES', 'master_data', 'inspection_schedules', false, true]);
            
            console.log(`✅ ルーティングを追加: INSPECTION_SCHEDULES → master_data.inspection_schedules`);
        }
        
        // 確認
        console.log('\n🔍 最終確認:');
        const finalCheck = await pool.query(`
            SELECT logical_resource_name, physical_schema, physical_table, is_active
            FROM public.app_resource_routing
            WHERE app_id = $1 AND (
                logical_resource_name LIKE '%inspection%' OR 
                logical_resource_name LIKE '%INSPECTION%'
            )
            ORDER BY logical_resource_name
        `, [appId]);
        
        finalCheck.rows.forEach(route => {
            const status = route.is_active ? '✓' : '✗';
            console.log(`   ${status} ${route.logical_resource_name} → ${route.physical_schema}.${route.physical_table}`);
        });
        
        console.log('\n✅ ルーティングの設定が完了しました！');
        
    } catch (err) {
        console.error('\n❌ エラー:', err.message);
        console.error('詳細:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

addInspectionScheduleRouting();
