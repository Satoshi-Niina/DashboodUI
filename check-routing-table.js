// app_resource_routingテーブルの確認スクリプト
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Takabeni@localhost:55432/webappdb'
});

async function checkRoutingTable() {
    try {
        console.log('🔍 ルーティングテーブルを確認します...\n');
        
        // publicスキーマのapp_resource_routingテーブルを確認
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'app_resource_routing'
            ) as exists
        `);
        
        if (tableCheck.rows[0].exists) {
            console.log('✅ public.app_resource_routingテーブルが存在します\n');
            
            // テーブル構造を確認
            const columns = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'app_resource_routing'
                ORDER BY ordinal_position
            `);
            
            console.log('📋 テーブル構造:');
            columns.rows.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });
            
            // 検修マスタ関連のルーティングを確認
            const routes = await pool.query(`
                SELECT * FROM public.app_resource_routing
                WHERE logical_resource_name IN ('inspection_types', 'inspection_schedules')
                OR logical_resource_name LIKE '%inspection%'
            `);
            
            console.log('\n🔍 検修マスタ関連のルーティング:');
            if (routes.rows.length > 0) {
                routes.rows.forEach(route => {
                    console.log(`   ✓ ${route.logical_resource_name}`);
                });
            } else {
                console.log('   ⚠️  検修マスタ関連のルーティングが見つかりません');
            }
            
            // すべてのルーティングを表示
            const allRoutes = await pool.query(`
                SELECT * FROM public.app_resource_routing
                ORDER BY logical_resource_name
            `);
            
            console.log('\n📊 全ルーティング (' + allRoutes.rows.length + '件):');
            allRoutes.rows.forEach(route => {
                console.log(`   - ${route.logical_resource_name || 'N/A'}: ${route.physical_schema}.${route.physical_table}`);
            });
            
        } else {
            console.log('⚠️  public.app_resource_routingテーブルが存在しません');
            console.log('\n他のスキーマを確認します...\n');
            
            // master_dataスキーマのtable_routingを確認
            const masterDataCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'master_data' 
                    AND table_name = 'table_routing'
                ) as exists
            `);
            
            if (masterDataCheck.rows[0].exists) {
                console.log('✅ master_data.table_routingテーブルが存在します\n');
                
                const routes = await pool.query(`
                    SELECT * FROM master_data.table_routing
                    WHERE logical_table_name IN ('inspection_types', 'inspection_schedules')
                    OR logical_table_name LIKE '%inspection%'
                `);
                
                console.log('🔍 検修マスタ関連のルーティング:');
                if (routes.rows.length > 0) {
                    routes.rows.forEach(route => {
                        console.log(`   ✓ ${route.logical_table_name} → ${route.schema_name}.${route.physical_table_name}`);
                    });
                } else {
                    console.log('   ⚠️  検修マスタ関連のルーティングが見つかりません');
                }
            }
        }
        
    } catch (err) {
        console.error('\n❌ エラー:', err.message);
        console.error('詳細:', err);
    } finally {
        await pool.end();
    }
}

checkRoutingTable();
