const pool = require('./shared-db-config');
const fs = require('fs');

async function executeSQLFile(sqlFilePath = 'database-complete-update.sql') {
    try {
        console.log('📂 Reading SQL file...');
        const sql = fs.readFileSync(sqlFilePath, 'utf-8');
        
        console.log('🔄 Executing SQL statements...\n');
        
        // Split by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            // Skip comments
            if (statement.startsWith('--')) continue;
            
            try {
                await pool.query(statement);
                successCount++;
                console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
            } catch (err) {
                // Some errors are expected (e.g., column already dropped)
                if (err.message.includes('does not exist') || 
                    err.message.includes('already exists') ||
                    err.message.includes('duplicate')) {
                    console.log(`⚠️ Statement ${i + 1}: ${err.message.split('\n')[0]}`);
                } else {
                    errorCount++;
                    console.error(`❌ Statement ${i + 1} failed:`, err.message);
                }
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Successful: ${successCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        
        // Verify changes
        console.log('\n🔍 Verifying changes...\n');
        
        const machinesSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns
            WHERE table_schema = 'master_data' AND table_name = 'machines'
            ORDER BY ordinal_position
        `);
        
        console.log('Machines table schema:');
        console.table(machinesSchema.rows);
        
        const vehiclesSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns
            WHERE table_schema = 'master_data' AND table_name = 'vehicles'
            AND column_name IN ('type_certification', 'acquisition_date')
        `);
        
        console.log('\nVehicles new columns:');
        console.table(vehiclesSchema.rows);
        
        console.log('\n✅ Database update complete!');
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

// コマンドライン引数からファイル名を取得
const sqlFile = process.argv[2] || 'database-complete-update.sql';
console.log(`📄 SQL File: ${sqlFile}`);
executeSQLFile(sqlFile);
