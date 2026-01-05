const pool = require('./shared-db-config');

async function checkCloudDBStructure() {
    try {
        console.log('🔍 CloudDB (webappdb) のテーブル構造を確認中...\n');
        
        // master_dataスキーマの重要なテーブルのスキーマを確認
        const tables = ['users', 'management_offices', 'bases', 'vehicles', 'maintenance_vehicles', 'machine_types', 'machines'];
        
        for (const tableName of tables) {
            try {
                const schema = await pool.query(`
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns 
                    WHERE table_schema = 'master_data' AND table_name = $1
                    ORDER BY ordinal_position
                `, [tableName]);
                
                if (schema.rows.length > 0) {
                    console.log(`\n✅ master_data.${tableName}:`);
                    console.table(schema.rows);
                    
                    // サンプルデータ
                    const data = await pool.query(`SELECT * FROM master_data.${tableName} LIMIT 3`);
                    console.log(`   データ件数: ${data.rows.length}件`);
                    if (data.rows.length > 0) {
                        console.table(data.rows);
                    }
                } else {
                    console.log(`\n⚠️ master_data.${tableName} は存在しません`);
                }
            } catch (err) {
                console.log(`\n❌ master_data.${tableName} エラー: ${err.message}`);
            }
        }
        
        // 現在のルーティング設定を確認
        console.log('\n\n📊 現在のルーティング設定:');
        const routing = await pool.query(`
            SELECT logical_resource_name, physical_table 
            FROM public.app_resource_routing 
            WHERE app_id = 'dashboard-ui'
            ORDER BY logical_resource_name
        `);
        console.table(routing.rows);
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
    } finally {
        await pool.end();
    }
}

checkCloudDBStructure();
