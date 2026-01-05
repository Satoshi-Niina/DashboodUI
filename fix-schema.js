const pool = require('./shared-db-config');

async function fixMachinesTable() {
    try {
        console.log('🔧 Fixing machines table schema...\n');
        
        // Add missing columns to machines table
        await pool.query(`
            ALTER TABLE master_data.machines
            ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
            ADD COLUMN IF NOT EXISTS manufacture_date DATE,
            ADD COLUMN IF NOT EXISTS purchase_date DATE,
            ADD COLUMN IF NOT EXISTS notes TEXT,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log('✅ Added missing columns to machines table');
        
        // Add missing column to vehicles table
        await pool.query(`
            ALTER TABLE master_data.vehicles
            ADD COLUMN IF NOT EXISTS type_certification VARCHAR(100);
        `);
        console.log('✅ Added type_certification to vehicles table');
        
        // Verify
        const machinesSchema = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'master_data' AND table_name = 'machines'
            ORDER BY ordinal_position
        `);
        
        console.log('\n📊 Current machines table schema:');
        console.table(machinesSchema.rows);
        
        const vehiclesSchema = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'master_data' AND table_name = 'vehicles'
            AND column_name IN ('type_certification', 'acquisition_date', 'office_id', 'machine_id')
            ORDER BY column_name
        `);
        
        console.log('\n📊 Vehicles table relevant columns:');
        console.table(vehiclesSchema.rows);
        
        console.log('\n✅ Schema fix complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

fixMachinesTable();
