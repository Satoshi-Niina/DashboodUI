
const pool = require('./shared-db-config');

async function inspectColumns() {
    try {
        const tables = ['machine_types', 'inspection_schedules'];
        
        for (const table of tables) {
            console.log(`\n🔍 ${table} テーブルの構造を確認します...\n`);
            
            const columnsResult = await pool.query(`
                SELECT 
                    column_name, 
                    data_type, 
                    is_nullable,
                    column_default
                FROM information_schema.columns 
                WHERE table_schema = 'master_data' 
                AND table_name = $1
                ORDER BY ordinal_position
            `, [table]);
            
            console.log(`📋 ${table} テーブルの列:`);
            if (columnsResult.rows.length === 0) {
                console.log('   (テーブルが見つかりません)');
            } else {
                columnsResult.rows.forEach(col => {
                    console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
                });
            }
        }

    } catch (error) {
        console.error('エラー:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

inspectColumns();
