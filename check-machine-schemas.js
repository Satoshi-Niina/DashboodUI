const pool = require('./shared-db-config');

async function checkMachineSchemas() {
    try {
        console.log('📊 Checking machine related tables...\n');
        
        const tables = ['machine_types', 'machines'];
        for (const table of tables) {
            const schemaQuery = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = $1
                ORDER BY table_schema, ordinal_position
            `, [table]);
            console.log(`\nTable: ${table}`);
            console.table(schemaQuery.rows);
            
            const sampleData = await pool.query(`SELECT * FROM master_data.${table} LIMIT 3`);
            console.log(`Sample data for ${table}:`);
            console.table(sampleData.rows);
        }
        
        console.log('\n📊 Checking app_resource_routing...\n');
        const routingData = await pool.query(`
            SELECT logical_resource_name, physical_schema, physical_table, is_active
            FROM public.app_resource_routing
            WHERE app_id = 'dashboard-ui'
        `);
        console.table(routingData.rows);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

checkMachineSchemas();
