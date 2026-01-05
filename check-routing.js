const pool = require('./shared-db-config');

async function checkRouting() {
    try {
        console.log('🔍 Checking app_resource_routing table...\n');
        
        // テーブルが存在するか確認
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'app_resource_routing'
            );
        `);
        
        console.log('Table exists:', tableExists.rows[0].exists);
        
        if (tableExists.rows[0].exists) {
            // ルーティング情報を取得
            const routing = await pool.query(`
                SELECT * FROM public.app_resource_routing 
                WHERE app_id = 'dashboard-ui' 
                ORDER BY logical_resource_name
            `);
            
            console.log('\n📊 Current routing configuration:');
            console.table(routing.rows);
        } else {
            console.log('\n⚠️ app_resource_routing table does not exist!');
            console.log('You need to run database-complete-update.sql');
        }
        
        // machinesテーブルのスキーマを確認
        console.log('\n🔍 Checking machines table schema...\n');
        const machinesSchema = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'master_data' AND table_name = 'machines'
            ORDER BY ordinal_position
        `);
        
        console.log('Machines table columns:');
        console.table(machinesSchema.rows);
        
        // assigned_base_idとstatusがまだ存在するか確認
        const hasOldColumns = machinesSchema.rows.some(
            col => col.column_name === 'assigned_base_id' || col.column_name === 'status'
        );
        
        if (hasOldColumns) {
            console.log('\n⚠️ WARNING: Old columns (assigned_base_id, status) still exist!');
            console.log('You need to run database-complete-update.sql to remove them.');
        } else {
            console.log('\n✅ Old columns have been removed.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

checkRouting();
